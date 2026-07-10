/**
 * Browser Automation Service
 * Handles automated job applications through various ATS systems
 */

// Note: Puppeteer requires browser installation which may not be available in all environments
// This service provides the structure for browser automation when available

export type ATSType = "greenhouse" | "lever" | "workday" | "taleo" | "icims" | "smartrecruiters" | "bamboohr" | "jobvite" | "unknown";

export interface ApplicationData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  /** A server-resolved local file path. Remote URLs cannot be uploaded by Puppeteer. */
  resumeFilePath?: string;
  coverLetter?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  currentCompany?: string;
  currentTitle?: string;
  yearsOfExperience?: number;
  salaryExpectation?: string;
  startDate?: string;
  workAuthorization?: string;
  requiresSponsorship?: boolean;
  customAnswers?: Record<string, string>;
}

export interface AutomationResult {
  success: boolean;
  prepared?: boolean;
  applicationId?: string;
  confirmationNumber?: string;
  error?: string;
  screenshot?: string;
  logs: string[];
}

export function getResumeUploadBlocker(data: ApplicationData): string | null {
  if (!data.resumeUrl) {
    return "A resume is required before Hire.AI can prepare this application.";
  }

  if (!data.resumeFilePath) {
    return "Resume upload is blocked because no server-resolved local resume artifact is available.";
  }

  return null;
}

/**
 * Detect ATS type from URL
 */
export function detectATSType(url: string): ATSType {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes("greenhouse.io") || urlLower.includes("boards.greenhouse")) {
    return "greenhouse";
  }
  if (urlLower.includes("lever.co") || urlLower.includes("jobs.lever")) {
    return "lever";
  }
  if (urlLower.includes("workday.com") || urlLower.includes("myworkday")) {
    return "workday";
  }
  if (urlLower.includes("taleo.net") || urlLower.includes("taleo.com")) {
    return "taleo";
  }
  if (urlLower.includes("icims.com")) {
    return "icims";
  }
  if (urlLower.includes("smartrecruiters.com")) {
    return "smartrecruiters";
  }
  if (urlLower.includes("bamboohr.com")) {
    return "bamboohr";
  }
  if (urlLower.includes("jobvite.com")) {
    return "jobvite";
  }
  
  return "unknown";
}

/**
 * Check whether a form can be filled for a user to review.
 * Final submission is deliberately disabled.
 */
export function isPreparationSupported(atsType: ATSType): boolean {
  const preparationSupportedATS: ATSType[] = ["greenhouse", "lever"];
  return preparationSupportedATS.includes(atsType);
}

/**
 * Get ATS-specific field mappings
 */
export function getATSFieldMappings(atsType: ATSType): Record<string, string> {
  switch (atsType) {
    case "greenhouse":
      return {
        firstName: 'input[name="first_name"], input[id*="first_name"]',
        lastName: 'input[name="last_name"], input[id*="last_name"]',
        email: 'input[name="email"], input[type="email"]',
        phone: 'input[name="phone"], input[type="tel"]',
        resume: 'input[type="file"][name*="resume"], input[type="file"][id*="resume"]',
        coverLetter: 'textarea[name*="cover"], textarea[id*="cover"]',
        linkedin: 'input[name*="linkedin"], input[id*="linkedin"]',
        portfolio: 'input[name*="portfolio"], input[name*="website"]',
      };
    case "lever":
      return {
        firstName: 'input[name="name"]',
        email: 'input[name="email"]',
        phone: 'input[name="phone"]',
        resume: 'input[type="file"]',
        coverLetter: 'textarea[name="comments"]',
        linkedin: 'input[name*="linkedin"]',
        portfolio: 'input[name*="portfolio"], input[name*="website"]',
      };
    case "workday":
      return {
        firstName: 'input[data-automation-id="firstName"], input[id*="firstName"]',
        lastName: 'input[data-automation-id="lastName"], input[id*="lastName"]',
        email: 'input[data-automation-id="email"], input[type="email"]',
        phone: 'input[data-automation-id="phone"], input[type="tel"]',
        resume: 'input[type="file"]',
      };
    default:
      return {
        firstName: 'input[name*="first"], input[id*="first"]',
        lastName: 'input[name*="last"], input[id*="last"]',
        email: 'input[type="email"], input[name*="email"]',
        phone: 'input[type="tel"], input[name*="phone"]',
        resume: 'input[type="file"]',
      };
  }
}

/**
 * Browser automation class for handling applications
 * Note: Requires puppeteer to be properly installed with browser
 */
export class BrowserAutomation {
  private browser: any = null;
  private page: any = null;
  private logs: string[] = [];

  private log(message: string) {
    const timestamp = new Date().toISOString();
    this.logs.push(`[${timestamp}] ${message}`);
    console.log(`[BrowserAutomation] ${message}`);
  }

  /**
   * Initialize browser with stealth mode
   */
  async initialize(): Promise<boolean> {
    try {
      // Dynamic import to handle cases where puppeteer isn't available
      const puppeteer = await import("puppeteer-extra").then(m => m.default);
      const StealthPlugin = await import("puppeteer-extra-plugin-stealth").then(m => m.default);
      
      puppeteer.use(StealthPlugin());
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920,1080",
        ],
      });
      
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      
      this.log("Browser initialized successfully");
      return true;
    } catch (error) {
      this.log(`Failed to initialize browser: ${error}`);
      return false;
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.log("Browser closed");
    }
  }

  /**
   * Navigate to URL and wait for load
   */
  async navigateTo(url: string): Promise<boolean> {
    try {
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      this.log(`Navigated to: ${url}`);
      return true;
    } catch (error) {
      this.log(`Navigation failed: ${error}`);
      return false;
    }
  }

  /**
   * Fill a form field
   */
  async fillField(selector: string, value: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector);
      await this.page.type(selector, value, { delay: 50 });
      this.log(`Filled field: ${selector}`);
      return true;
    } catch (error) {
      this.log(`Failed to fill field ${selector}: ${error}`);
      return false;
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(selector: string, filePath: string): Promise<boolean> {
    try {
      const input = await this.page.$(selector);
      if (input) {
        await input.uploadFile(filePath);
        this.log(`Uploaded file to: ${selector}`);
        return true;
      }
      return false;
    } catch (error) {
      this.log(`Failed to upload file: ${error}`);
      return false;
    }
  }

  /**
   * Click a button
   */
  async clickButton(selector: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector);
      this.log(`Clicked: ${selector}`);
      return true;
    } catch (error) {
      this.log(`Failed to click ${selector}: ${error}`);
      return false;
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(): Promise<string | null> {
    try {
      const screenshot = await this.page.screenshot({ encoding: "base64" });
      return screenshot;
    } catch (error) {
      this.log(`Failed to take screenshot: ${error}`);
      return null;
    }
  }

  /**
   * Get current logs
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Apply to Greenhouse job
   */
  async applyGreenhouse(url: string, data: ApplicationData): Promise<AutomationResult> {
    this.logs = [];
    const result: AutomationResult = { success: false, logs: [] };

    try {
      if (!await this.navigateTo(url)) {
        throw new Error("Failed to navigate to job page");
      }

      // Wait for application form
      await this.page.waitForSelector('form, [data-qa="application-form"]', { timeout: 10000 });

      const mappings = getATSFieldMappings("greenhouse");

      // Fill basic fields
      if (data.firstName) await this.fillField(mappings.firstName, data.firstName);
      if (data.lastName) await this.fillField(mappings.lastName, data.lastName);
      if (data.email) await this.fillField(mappings.email, data.email);
      if (data.phone) await this.fillField(mappings.phone, data.phone);
      if (data.linkedinUrl) await this.fillField(mappings.linkedin, data.linkedinUrl);
      if (data.portfolioUrl) await this.fillField(mappings.portfolio, data.portfolioUrl);
      if (data.coverLetter) await this.fillField(mappings.coverLetter, data.coverLetter);

      const resumeUploaded = await this.uploadFile(mappings.resume, data.resumeFilePath!);
      if (!resumeUploaded) {
        throw new Error("Resume upload could not be verified in the Greenhouse form");
      }

      // Handle custom questions (would need to be detected dynamically)
      
      // Take screenshot before submission
      result.screenshot = await this.takeScreenshot() || undefined;

      // Note: Actual submission is commented out for safety
      // await this.clickButton('button[type="submit"], input[type="submit"]');

      result.prepared = true;
      result.logs = this.getLogs();
      this.log("Application form filled successfully (submission disabled for safety)");

    } catch (error) {
      result.error = `${error}`;
      result.logs = this.getLogs();
    }

    return result;
  }

  /**
   * Apply to Lever job
   */
  async applyLever(url: string, data: ApplicationData): Promise<AutomationResult> {
    this.logs = [];
    const result: AutomationResult = { success: false, logs: [] };

    try {
      if (!await this.navigateTo(url)) {
        throw new Error("Failed to navigate to job page");
      }

      // Click apply button
      await this.clickButton('a[href*="apply"], button[class*="apply"]');
      await this.page.waitForTimeout(2000);

      const mappings = getATSFieldMappings("lever");

      // Fill form
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      if (fullName) await this.fillField(mappings.firstName, fullName);
      if (data.email) await this.fillField(mappings.email, data.email);
      if (data.phone) await this.fillField(mappings.phone, data.phone);
      if (data.coverLetter) await this.fillField(mappings.coverLetter, data.coverLetter);

      const resumeUploaded = await this.uploadFile(mappings.resume, data.resumeFilePath!);
      if (!resumeUploaded) {
        throw new Error("Resume upload could not be verified in the Lever form");
      }

      result.screenshot = await this.takeScreenshot() || undefined;
      result.prepared = true;
      result.logs = this.getLogs();
      this.log("Application form filled successfully (submission disabled for safety)");

    } catch (error) {
      result.error = `${error}`;
      result.logs = this.getLogs();
    }

    return result;
  }
}

/**
 * Main automation function
 */
export async function automateApplication(
  url: string,
  data: ApplicationData
): Promise<AutomationResult> {
  const atsType = detectATSType(url);
  const resumeBlocker = getResumeUploadBlocker(data);

  if (resumeBlocker) {
    return {
      success: false,
      prepared: false,
      error: resumeBlocker,
      logs: [`Detected ATS: ${atsType}`, resumeBlocker],
    };
  }
  
  if (!isPreparationSupported(atsType)) {
    return {
      success: false,
      error: `Form preparation is not supported for ATS type: ${atsType}`,
      logs: [`Detected ATS: ${atsType}`, "This ATS requires manual application"],
    };
  }

  const automation = new BrowserAutomation();
  
  try {
    const initialized = await automation.initialize();
    if (!initialized) {
      return {
        success: false,
        error: "Failed to initialize browser automation",
        logs: automation.getLogs(),
      };
    }

    let result: AutomationResult;
    
    switch (atsType) {
      case "greenhouse":
        result = await automation.applyGreenhouse(url, data);
        break;
      case "lever":
        result = await automation.applyLever(url, data);
        break;
      default:
        result = {
          success: false,
          error: `No automation handler for: ${atsType}`,
          logs: automation.getLogs(),
        };
    }

    return result;
  } finally {
    await automation.close();
  }
}

/**
 * Prepare application data from user profile
 */
export function prepareApplicationData(
  userProfile: any,
  job: any,
  coverLetter?: string
): ApplicationData {
  // Parse name from profile or user
  const nameParts = (userProfile?.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  return {
    firstName,
    lastName,
    email: userProfile?.email || "",
    phone: userProfile?.phone || "",
    resumeUrl: userProfile?.resumeUrl,
    coverLetter: coverLetter || `I am excited to apply for the ${job?.title || "position"} at ${job?.company || "your company"}.`,
    linkedinUrl: userProfile?.linkedinUrl,
    portfolioUrl: userProfile?.portfolioUrl,
    currentCompany: userProfile?.currentCompany,
    currentTitle: userProfile?.currentTitle,
    requiresSponsorship: userProfile?.needsVisaSponsorship === 1,
  };
}
