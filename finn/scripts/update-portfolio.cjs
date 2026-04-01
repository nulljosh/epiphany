const { chromium } = require('playwright-core');
const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CHROME_PROFILE = path.join(process.env.HOME, 'Library/Application Support/Google/Chrome/Default');
const INDEX_HTML = path.join(__dirname, '../index.html');

async function sendOpenClawMessage(message) {
  const { execSync } = require('child_process');
  try {
    // Use AppleScript to send iMessage via OpenClaw
    const script = `
      tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "openclaw@icloud.com" of targetService
        send "${message}" to targetBuddy
      end tell
    `;
    execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    console.log('[+] Sent iMessage via OpenClaw');
  } catch (err) {
    console.log('[!] Failed to send OpenClaw message:', err.message);
  }
}

async function get2FACodeFromMessages(timeoutMs = 180000) {
  const startTime = Date.now();
  const dbPath = path.join(os.homedir(), 'Library/Messages/chat.db');

  // Send request via OpenClaw
  await sendOpenClawMessage('[2FA] Need Wealthsimple 2FA code - please forward the SMS');
  console.log('[*] Waiting for 2FA code forwarded to OpenClaw...');

  while (Date.now() - startTime < timeoutMs) {
    try {
      const db = new Database(dbPath, { readonly: true });

      // Look for messages from YOU (is_from_me = 1) in last 3 minutes
      // Messages DB uses Apple's epoch (2001-01-01 00:00:00 UTC)
      const cutoffDate = (Date.now() / 1000 - 180) * 1000000000 + 978307200 * 1000000000;

      const row = db.prepare(`
        SELECT text
        FROM message
        WHERE is_from_me = 1
          AND text IS NOT NULL
          AND date > ?
        ORDER BY date DESC
        LIMIT 5
      `).all(cutoffDate);

      db.close();

      // Check all recent messages from you for a 6-digit code
      for (const msg of row) {
        if (msg.text) {
          // Extract 6-digit code
          const match = msg.text.match(/\b\d{6}\b/);
          if (match) {
            console.log(`[+] Found 2FA code in forwarded message: ${match[0]}`);
            return match[0];
          }
        }
      }
    } catch (err) {
      console.log('[!] Error reading Messages database:', err.message);
    }

    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timeout waiting for 2FA code in Messages');
}

async function fetchExchangeRate() {
  console.log('[*] Fetching CAD/USD exchange rate...');
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/CAD');
    const data = await response.json();
    const rate = data.rates.USD;
    console.log(`[+] Exchange rate: 1 CAD = ${rate} USD`);
    return rate;
  } catch (error) {
    console.log('[!] Failed to fetch exchange rate, using fallback 0.73');
    return 0.73; // Fallback rate
  }
}

async function scrapeWealthsimple(headless = false) {
  let browser;

  try {
    console.log('[*] Launching Chrome with profile...');

    // Check if Chrome profile exists
    try {
      await fs.access(CHROME_PROFILE);
      console.log(`[+] Using Chrome profile: ${CHROME_PROFILE}`);
    } catch {
      console.log('[!] Chrome profile not found, will use default settings');
    }

    const launchOptions = {
      headless: headless,
      defaultViewport: headless ? { width: 1920, height: 1080 } : null,
      args: headless ? [] : ['--start-maximized'],
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      userDataDir: CHROME_PROFILE
    };

    browser = await chromium.launch({
      headless: launchOptions.headless,
      executablePath: launchOptions.executablePath,
      args: launchOptions.args,
      chromiumSandbox: false
    });
    const context = await browser.newContext({ viewport: launchOptions.defaultViewport || null });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60000);

    console.log('[*] Navigating to Wealthsimple...');
    await page.goto('https://my.wealthsimple.com', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we need to log in
    const currentUrl = page.url();
    console.log(`[*] Current URL: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl.includes('sign-in')) {
      console.log('[*] Logging in with credentials...');

      const email = process.env.WEALTHSIMPLE_EMAIL;
      const password = process.env.WEALTHSIMPLE_PASSWORD;

      if (!email || !password) {
        throw new Error('Missing WEALTHSIMPLE_EMAIL or WEALTHSIMPLE_PASSWORD in .env file');
      }

      // Wait for login form to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fill in BOTH email and password (they're on the same page)
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      await page.type('input[type="email"], input[name="email"]', email, { delay: 50 });
      console.log('[+] Email entered');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Wait for password field and fill it
      await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 10000 });
      await page.type('input[type="password"], input[name="password"]', password, { delay: 50 });
      console.log('[+] Password entered');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Submit form by pressing Enter on password field
      console.log('[*] Submitting login form...');
      await page.focus('input[type="password"]');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => console.log('[!] Navigation timeout')),
        page.keyboard.press('Enter')
      ]);

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if 2FA is required by looking for the code input field
      const has2FAField = await page.$('input[placeholder*="code"], input[type="text"]');
      const current = page.url();
      console.log(`[*] Post-login URL: ${current}`);

      if (has2FAField || current.includes('2fa') || current.includes('verify') || current.includes('mfa') || current.includes('otp')) {
        console.log('[+] 2FA page detected!');

        let twoFACode = process.env.WEALTHSIMPLE_2FA_CODE;

        // If no code in env, try to get it from Messages.app
        if (!twoFACode) {
          console.log('[*] No 2FA code in .env, attempting to read from Messages.app...');
          try {
            twoFACode = await get2FACodeFromMessages(180000); // 3 minute timeout
          } catch (err) {
            console.log('[!] Could not get code automatically:', err.message);
            console.log('\n╔════════════════════════════════════════════════╗');
            console.log('║  2FA REQUIRED - ENTER CODE IN BROWSER WINDOW   ║');
            console.log('║  Or set WEALTHSIMPLE_2FA_CODE in .env          ║');
            console.log('╚════════════════════════════════════════════════╝\n');

            // Wait for 2FA completion
            await page.waitForFunction(
              () => !window.location.href.includes('2fa') &&
                    !window.location.href.includes('verify') &&
                    !window.location.href.includes('mfa') &&
                    !window.location.href.includes('otp') &&
                    !window.location.href.includes('login'),
              { timeout: 180000 } // 3 minutes
            );

            console.log('[+] 2FA completed!');
            return; // Skip the rest of the automated 2FA flow
          }
        }

        if (twoFACode) {
          console.log('[*] Entering 2FA code...');

          // Fill in 2FA code
          await page.waitForSelector('input[placeholder*="code"], input[type="text"]', { timeout: 10000 });
          await page.type('input[placeholder*="code"], input[type="text"]', twoFACode, { delay: 100 });
          console.log('[+] 2FA code entered');

          // Check "trust this device" checkbox
          try {
            await page.evaluate(() => {
              const checkbox = document.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
              }
            });
            console.log('[+] Trusted device checkbox checked');
          } catch (err) {
            console.log('[!] Could not check trust device checkbox');
          }

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Click submit button
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
            page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              for (const btn of buttons) {
                const text = btn.innerText?.toLowerCase() || '';
                if (text.includes('submit') || text.includes('verify') || text.includes('continue')) {
                  btn.click();
                  return;
                }
              }
            })
          ]);

          console.log('[+] 2FA submitted!');
        }

        console.log('[+] 2FA completed!');
      }

      console.log('[+] Authentication complete!');
    } else {
      console.log('[+] Already logged in!');
    }

    // Navigate to home page (where balances are shown)
    console.log('[*] Navigating to home page...');
    await page.goto('https://my.wealthsimple.com/app/home', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('[*] Scraping portfolio data...');

    // Take a screenshot for debugging
    const screenshotPath = path.join(__dirname, '../data/portfolio-screenshot.png');
    try {
      await fs.mkdir(path.join(__dirname, '../data'), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[*] Screenshot saved: ${screenshotPath}`);
    } catch (err) {
      console.log('[!] Screenshot failed:', err.message);
    }

    // Scrape account data
    const portfolioData = await page.evaluate(() => {
      const data = { accounts: [], raw: [] };

      // Strategy 1: Look for common patterns in text content
      const bodyText = document.body.innerText;

      // Look for dollar amounts
      const amountRegex = /\$[\d,]+\.?\d{0,2}/g;
      const amounts = bodyText.match(amountRegex) || [];

      // Look for account names
      const accountKeywords = ['vacation', 'chequing', 'tfsa', 'cash', 'savings'];

      // Try to find structured data
      const elements = document.querySelectorAll('div, span, p, td');
      elements.forEach(el => {
        const text = el.innerText?.trim() || '';
        if (text.length < 100 && text.length > 5) {
          data.raw.push(text);
        }
      });

      return {
        amounts: amounts.slice(0, 20), // First 20 amounts found
        raw: data.raw.slice(0, 50), // First 50 text snippets
        bodyPreview: bodyText.substring(0, 500)
      };
    });

    console.log('[+] Portfolio data scraped:');
    console.log('   Amounts found:', portfolioData.amounts);
    console.log('   Text snippets:', portfolioData.raw.slice(0, 10));

    await browser.close();

    return portfolioData;

  } catch (error) {
    console.error('[!] Error scraping Wealthsimple:', error.message);

    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    throw error;
  }
}

async function parsePortfolioData(scrapedData) {
  console.log('\n[*] Parsing portfolio data...');

  // For now, we'll need to manually identify the values from the scraped data
  // This is a placeholder - in reality we'd need to inspect the screenshot
  // and actual HTML structure to build proper selectors

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  MANUAL STEP REQUIRED                          ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('\nPlease check the screenshot at:');
  console.log('  data/portfolio-screenshot.png');
  console.log('\nAnd enter the values manually:');

  // For now, return null to indicate manual intervention needed
  return null;
}

async function updateIndexHTML(vacationBalance, tfsaBalance, usdTotal) {
  console.log('[*] Updating index.html...');

  const html = await fs.readFile(INDEX_HTML, 'utf-8');

  // Update vacation balance
  let updated = html.replace(
    /(<tr><td><div class="s">Vacation<\/div><div class="m">Chequing \(available\)<\/div><\/td><td>)\$[\d,]+\.?\d{0,2} CAD(<\/td><\/tr>)/,
    `$1$${vacationBalance.toFixed(2)} CAD$2`
  );

  // Update TFSA balance
  updated = updated.replace(
    /(<tr><td><div class="s">TFSA<\/div><div class="m">Cash \(available\)<\/div><\/td><td>)\$[\d,]+\.?\d{0,2} CAD(<\/td><\/tr>)/,
    `$1$${tfsaBalance.toFixed(2)} CAD$2`
  );

  // Update USD total
  updated = updated.replace(
    /(<tr class="t"><td>Total<\/td><td>)~\$[\d,]+ USD(<\/td><\/tr>)/,
    `$1~$${Math.round(usdTotal)} USD$2`
  );

  // Update last updated date
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  updated = updated.replace(
    /Last updated [A-Za-z]+ \d+, \d{4}/,
    `Last updated ${today}`
  );

  await fs.writeFile(INDEX_HTML, updated, 'utf-8');
  console.log('[+] index.html updated successfully');
}

async function gitCommitAndPush() {
  console.log('[*] Creating git commit...');
  const { execSync } = require('child_process');

  try {
    execSync('git add index.html', { cwd: path.join(__dirname, '..') });

    const commitMessage = `Update portfolio balances from Wealthsimple

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`;

    execSync(`git commit -m "${commitMessage}"`, { cwd: path.join(__dirname, '..') });
    console.log('[+] Commit created');

    // Note: Not auto-pushing to give user chance to review
    console.log('[*] Run "git push" to publish changes');

  } catch (error) {
    console.log('[!] Git commit failed:', error.message);
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   WEALTHSIMPLE PORTFOLIO AUTOMATION v1.0       ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Scrape Wealthsimple
    const portfolioData = await scrapeWealthsimple(false);

    // Step 2: Parse data (this will need manual refinement)
    const parsed = await parsePortfolioData(portfolioData);

    if (!parsed) {
      console.log('\n[!] Could not auto-parse portfolio data');
      console.log('[*] Please inspect the screenshot and update selectors in the script');
      console.log('\nScraped data saved for manual review.');

      // Save raw data
      await fs.writeFile(
        path.join(__dirname, '../data/scraped-data.json'),
        JSON.stringify(portfolioData, null, 2)
      );

      return;
    }

    // Step 3: Get exchange rate
    const exchangeRate = await fetchExchangeRate();

    // Step 4: Calculate USD total
    const cadTotal = parsed.vacation + parsed.tfsa;
    const usdTotal = cadTotal * exchangeRate;

    console.log(`\n[+] Balances:`);
    console.log(`   Vacation: $${parsed.vacation.toFixed(2)} CAD`);
    console.log(`   TFSA:     $${parsed.tfsa.toFixed(2)} CAD`);
    console.log(`   Total:    ~$${Math.round(usdTotal)} USD`);

    // Step 5: Update HTML
    await updateIndexHTML(parsed.vacation, parsed.tfsa, usdTotal);

    // Step 6: Git commit
    await gitCommitAndPush();

    console.log('\n[+] Portfolio update complete!');

  } catch (error) {
    console.error('\n[!] Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrapeWealthsimple, updateIndexHTML };
