#!/usr/bin/env node

/**
 * Twitter/X.com Tweet Scraper
 * Fetches tweet content using Puppeteer (headless browser)
 * Usage: node fetch-tweet.js <tweet_url>
 */

const puppeteer = require('puppeteer-core');

async function fetchTweet(url, options = {}) {
  const { silent = false } = options;
  const maxRetries = 3;
  let attempt = 0;

  const log = (...args) => !silent && console.log(...args);
  const error = (...args) => !silent && console.error(...args);

  while (attempt < maxRetries) {
    attempt++;
    log(`\nAttempt ${attempt}/${maxRetries}...`);

    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      });

      const page = await browser.newPage();

      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      log(`Navigating to ${url}...`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for tweet content to load
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

      // Extract tweet data
      const tweetData = await page.evaluate(() => {
        const article = document.querySelector('article[data-testid="tweet"]');
        if (!article) return null;

        // Get tweet text
        const textElement = article.querySelector('[data-testid="tweetText"]');
        const text = textElement ? textElement.innerText : '';

        // Get author info
        const authorElement = article.querySelector('[data-testid="User-Name"]');
        const author = authorElement ? authorElement.innerText : '';

        // Get images
        const images = Array.from(article.querySelectorAll('img[src*="media"]')).map(img => img.src);

        // Get timestamp
        const timeElement = article.querySelector('time');
        const timestamp = timeElement ? timeElement.getAttribute('datetime') : '';

        return {
          text,
          author,
          images,
          timestamp,
          url: window.location.href
        };
      });

      await browser.close();

      if (tweetData && tweetData.text) {
        log('\n[OK] Tweet fetched successfully!\n');
        log('━'.repeat(80));
        log(`Author: ${tweetData.author}`);
        log(`Date: ${tweetData.timestamp}`);
        log('━'.repeat(80));
        log(`\n${tweetData.text}\n`);

        if (tweetData.images.length > 0) {
          log('━'.repeat(80));
          log('Images:');
          tweetData.images.forEach((img, i) => log(`  ${i + 1}. ${img}`));
        }
        log('━'.repeat(80));

        return tweetData;
      }

      log('[WARN] No tweet content found, retrying...');

    } catch (err) {
      error(`[ERR] Attempt ${attempt} failed:`, err.message);

      if (browser) {
        await browser.close();
      }

      if (attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff
        log(`Waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  error('\n[ERR] Failed to fetch tweet after all retries');
  return null;
}

// CLI usage
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const url = args.find(arg => !arg.startsWith('--'));

if (!url) {
  console.error('Usage: node fetch-tweet.js <tweet_url> [--json]');
  process.exit(1);
}

if (!url.includes('twitter.com') && !url.includes('x.com')) {
  console.error('Error: URL must be a Twitter/X.com link');
  process.exit(1);
}

fetchTweet(url, { silent: jsonMode })
  .then(data => {
    if (data) {
      if (jsonMode) {
        console.log(JSON.stringify(data, null, 2));
      }
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

module.exports = { fetchTweet };
