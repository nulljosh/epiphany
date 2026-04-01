#!/usr/bin/env node

/**
 * Enhanced Twitter/X Scraper
 *
 * Features:
 * - Fetch individual tweets
 * - Fetch user bookmarks (requires auth)
 * - Fetch user timeline
 * - Fetch user profiles
 * - Cookie-based authentication
 * - Shadowban detection
 * - Rate limit handling
 *
 * Usage:
 *   node twitter-scraper.js tweet <url>                    # Fetch single tweet
 *   node twitter-scraper.js bookmarks [limit]              # Fetch your bookmarks
 *   node twitter-scraper.js timeline <username> [limit]    # Fetch user tweets
 *   node twitter-scraper.js profile <username>             # Fetch user profile
 *   node twitter-scraper.js --json                         # JSON output
 *   node twitter-scraper.js --login                        # Setup auth cookies
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const COOKIES_FILE = path.join(__dirname, '.twitter-cookies.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

class TwitterScraper {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false,
      silent: options.silent || false,
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3
    };
    this.browser = null;
    this.page = null;
  }

  log(...args) {
    if (!this.options.silent) console.log(...args);
  }

  error(...args) {
    if (!this.options.silent) console.error(...args);
  }

  async init() {
    this.browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Load cookies if they exist
    await this.loadCookies();

    // Enhanced stealth
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  async loadCookies() {
    try {
      const cookiesString = await fs.readFile(COOKIES_FILE, 'utf8');
      const cookies = JSON.parse(cookiesString);
      await this.page.setCookie(...cookies);
      this.log('Loaded auth cookies');
    } catch (err) {
      this.log('No saved cookies found');
    }
  }

  async saveCookies() {
    const cookies = await this.page.cookies();
    await fs.writeFile(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    this.log(`Saved cookies to ${COOKIES_FILE}`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async login() {
    this.log('Opening Twitter login page...');
    this.log('Please log in manually in the browser window.');

    await this.page.goto('https://x.com/login', {
      waitUntil: 'networkidle2',
      timeout: this.options.timeout
    });

    this.log('Waiting for login... (will auto-detect when complete)');

    // Wait for successful login (redirects to home page)
    await this.page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 300000 // 5 minutes for manual login
    });

    await this.saveCookies();
    this.log('Login successful! Cookies saved.');
  }

  async detectRateLimit() {
    const content = await this.page.content();
    return content.includes('rate limit') ||
           content.includes('Rate limit') ||
           content.includes('try again later');
  }

  async detectShadowban() {
    const content = await this.page.content();
    return content.includes('This account doesn\'t exist') ||
           content.includes('Account suspended') ||
           content.includes('temporarily unavailable');
  }

  async fetchTweet(url) {
    let attempt = 0;

    while (attempt < this.options.maxRetries) {
      attempt++;
      this.log(`Attempt ${attempt}/${this.options.maxRetries}...`);

      try {
        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: this.options.timeout
        });

        // Check for rate limit
        if (await this.detectRateLimit()) {
          throw new Error('Rate limited by Twitter');
        }

        // Wait for tweet content
        await this.page.waitForSelector('article[data-testid="tweet"]', {
          timeout: 10000
        });

        const tweetData = await this.page.evaluate(() => {
          const article = document.querySelector('article[data-testid="tweet"]');
          if (!article) return null;

          // Get tweet text
          const textElement = article.querySelector('[data-testid="tweetText"]');
          const text = textElement ? textElement.innerText : '';

          // Get author info
          const authorElement = article.querySelector('[data-testid="User-Name"]');
          const author = authorElement ? authorElement.innerText : '';

          // Get images
          const images = Array.from(article.querySelectorAll('img[src*="media"]'))
            .map(img => img.src);

          // Get videos
          const videos = Array.from(article.querySelectorAll('video'))
            .map(v => v.src);

          // Get timestamp
          const timeElement = article.querySelector('time');
          const timestamp = timeElement ? timeElement.getAttribute('datetime') : '';

          // Get metrics
          const replies = article.querySelector('[data-testid="reply"]')?.innerText || '0';
          const retweets = article.querySelector('[data-testid="retweet"]')?.innerText || '0';
          const likes = article.querySelector('[data-testid="like"]')?.innerText || '0';

          return {
            text,
            author,
            images,
            videos,
            timestamp,
            metrics: { replies, retweets, likes },
            url: window.location.href
          };
        });

        if (tweetData && tweetData.text) {
          this.log('\n[OK] Tweet fetched successfully!\n');
          return tweetData;
        }

        this.log('No tweet content found, retrying...');

      } catch (err) {
        this.error(`[ERR] Attempt ${attempt} failed:`, err.message);

        if (attempt < this.options.maxRetries) {
          const delay = attempt * 2000;
          this.log(`Waiting ${delay/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error('Failed to fetch tweet after all retries');
  }

  async fetchBookmarks(limit = 50) {
    this.log(`Fetching your bookmarks...`);

    const url = `https://x.com/i/bookmarks`;

    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: this.options.timeout
    });

    // Check if logged in
    const loginRequired = await this.page.$('a[href="/login"]');
    if (loginRequired) {
      throw new Error('Login required to access bookmarks. Run with --login first.');
    }

    // Check for shadowban
    if (await this.detectShadowban()) {
      throw new Error('User appears to be shadowbanned or doesn\'t exist');
    }

    const bookmarks = [];
    let lastHeight = 0;
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(limit / 10); // ~10 tweets per scroll

    this.log('Scrolling and collecting bookmarks...');

    while (bookmarks.length < limit && scrollAttempts < maxScrolls) {
      // Extract tweets from current view
      const tweets = await this.page.evaluate(() => {
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        return Array.from(articles).map(article => {
          const textElement = article.querySelector('[data-testid="tweetText"]');
          const text = textElement ? textElement.innerText : '';

          const authorElement = article.querySelector('[data-testid="User-Name"]');
          const author = authorElement ? authorElement.innerText : '';

          const linkElement = article.querySelector('a[href*="/status/"]');
          const url = linkElement ? linkElement.href : '';

          const timeElement = article.querySelector('time');
          const timestamp = timeElement ? timeElement.getAttribute('datetime') : '';

          return { text, author, url, timestamp };
        });
      });

      // Add new unique tweets
      tweets.forEach(tweet => {
        if (!bookmarks.find(b => b.url === tweet.url)) {
          bookmarks.push(tweet);
        }
      });

      this.log(`Collected ${bookmarks.length} bookmarks so far...`);

      // Scroll down
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if page height changed
      const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
      if (newHeight === lastHeight) {
        this.log('Reached end of bookmarks');
        break;
      }

      lastHeight = newHeight;
      scrollAttempts++;
    }

    return bookmarks.slice(0, limit);
  }

  async fetchTimeline(username, limit = 20) {
    this.log(`Fetching timeline for @${username}...`);

    const url = `https://x.com/${username}`;

    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: this.options.timeout
    });

    // Check for shadowban
    if (await this.detectShadowban()) {
      throw new Error('User appears to be shadowbanned or doesn\'t exist');
    }

    const tweets = [];
    let lastHeight = 0;
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(limit / 10);

    this.log('Scrolling and collecting tweets...');

    while (tweets.length < limit && scrollAttempts < maxScrolls) {
      const newTweets = await this.page.evaluate(() => {
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        return Array.from(articles).map(article => {
          const textElement = article.querySelector('[data-testid="tweetText"]');
          const text = textElement ? textElement.innerText : '';

          const authorElement = article.querySelector('[data-testid="User-Name"]');
          const author = authorElement ? authorElement.innerText : '';

          const linkElement = article.querySelector('a[href*="/status/"]');
          const url = linkElement ? linkElement.href : '';

          const timeElement = article.querySelector('time');
          const timestamp = timeElement ? timeElement.getAttribute('datetime') : '';

          const images = Array.from(article.querySelectorAll('img[src*="media"]'))
            .map(img => img.src);

          return { text, author, url, timestamp, images };
        });
      });

      newTweets.forEach(tweet => {
        if (!tweets.find(t => t.url === tweet.url)) {
          tweets.push(tweet);
        }
      });

      this.log(`Collected ${tweets.length} tweets so far...`);

      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
      if (newHeight === lastHeight) break;

      lastHeight = newHeight;
      scrollAttempts++;
    }

    return tweets.slice(0, limit);
  }

  async fetchProfile(username) {
    this.log(`Fetching profile for @${username}...`);

    const url = `https://x.com/${username}`;

    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: this.options.timeout
    });

    // Check for shadowban/suspension
    if (await this.detectShadowban()) {
      return {
        username,
        status: 'shadowbanned_or_suspended',
        error: 'Account appears to be shadowbanned, suspended, or doesn\'t exist'
      };
    }

    // Wait for profile to load
    await this.page.waitForSelector('[data-testid="UserName"]', {
      timeout: 10000
    });

    // Extract profile data
    const profile = await this.page.evaluate(() => {
      // Bio
      const bioElement = document.querySelector('[data-testid="UserDescription"]');
      const bio = bioElement ? bioElement.innerText : '';

      // Display name
      const nameElement = document.querySelector('[data-testid="UserName"]');
      const name = nameElement ? nameElement.innerText.split('\n')[0] : '';

      // Stats (followers, following, tweets)
      const stats = Array.from(document.querySelectorAll('a[href$="/followers"], a[href$="/following"], a[href$="/verified_followers"]'))
        .map(el => el.innerText);

      // Location
      const locationElement = document.querySelector('[data-testid="UserLocation"]');
      const location = locationElement ? locationElement.innerText : '';

      // Website
      const websiteElement = document.querySelector('[data-testid="UserUrl"] a');
      const website = websiteElement ? websiteElement.href : '';

      // Joined date
      const joinedElement = document.querySelector('[data-testid="UserJoinDate"]');
      const joined = joinedElement ? joinedElement.innerText : '';

      // Profile image
      const imageElement = document.querySelector('img[src*="profile_images"]');
      const profileImage = imageElement ? imageElement.src : '';

      // Banner
      const bannerElement = document.querySelector('img[src*="profile_banners"]');
      const bannerImage = bannerElement ? bannerElement.src : '';

      // Pinned tweet
      const pinnedElement = document.querySelector('[data-testid="tweet"]');
      const pinnedTweet = pinnedElement ? {
        text: pinnedElement.querySelector('[data-testid="tweetText"]')?.innerText || '',
        url: pinnedElement.querySelector('a[href*="/status/"]')?.href || ''
      } : null;

      return {
        name,
        bio,
        stats: stats.join(' | '),
        location,
        website,
        joined,
        profileImage,
        bannerImage,
        pinnedTweet
      };
    });

    return {
      username,
      status: 'active',
      ...profile
    };
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const jsonMode = args.includes('--json');
  const loginMode = args.includes('--login');

  const scraper = new TwitterScraper({
    silent: jsonMode,
    headless: !loginMode && !args.includes('--no-headless')
  });

  try {
    await scraper.init();

    if (loginMode) {
      await scraper.login();
      await scraper.close();
      return;
    }

    let result;

    switch (command) {
      case 'tweet': {
        const url = args[1];
        if (!url) {
          console.error('Usage: twitter-scraper.js tweet <url>');
          process.exit(1);
        }
        result = await scraper.fetchTweet(url);
        break;
      }

      case 'bookmarks': {
        const limit = parseInt(args[1]) || 50;
        result = await scraper.fetchBookmarks(limit);
        break;
      }

      case 'timeline': {
        const username = args[1];
        const limit = parseInt(args[2]) || 20;
        if (!username) {
          console.error('Usage: twitter-scraper.js timeline <username> [limit]');
          process.exit(1);
        }
        result = await scraper.fetchTimeline(username, limit);
        break;
      }

      case 'profile': {
        const username = args[1];
        if (!username) {
          console.error('Usage: twitter-scraper.js profile <username>');
          process.exit(1);
        }
        result = await scraper.fetchProfile(username);
        break;
      }

      default:
        console.error('Usage:');
        console.error('  twitter-scraper.js tweet <url>');
        console.error('  twitter-scraper.js bookmarks [limit]');
        console.error('  twitter-scraper.js timeline <username> [limit]');
        console.error('  twitter-scraper.js profile <username>');
        console.error('  twitter-scraper.js --login');
        console.error('\nOptions:');
        console.error('  --json          JSON output');
        console.error('  --no-headless   Show browser window');
        process.exit(1);
    }

    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('━'.repeat(80));
      console.log(JSON.stringify(result, null, 2));
      console.log('━'.repeat(80));
    }

    await scraper.close();
    process.exit(0);

  } catch (error) {
    console.error('Error:', error.message);
    await scraper.close();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { TwitterScraper };
