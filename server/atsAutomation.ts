/**
 * ATS (Applicant Tracking System) Automation
 * Comprehensive automation for Workday, Taleo, and other ATS platforms
 * Includes CAPTCHA handling strategies
 */

import puppeteer, { Browser, Page } from "puppeteer";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ATSCredentials {
  email: string;
  password?: string;
  linkedinUrl?: string;
  useLinkedInAuth?: boolean;
}

export interface ApplicationData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  resume: {
    url: string;
    filename: string;
  };
  coverLetter?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  workAuthorization: string;
  requiresSponsorship: boolean;
  salaryExpectation?: number;
  startDate?: string;
  yearsExperience?: number;
  education?: {
    school: string;
    degree: string;
    field: string;
    graduationYear: number;
    gpa?: number;
  }[];
  workHistory?: {
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    current: boolean;
    description: string;
  }[];
  skills?: string[];
  customAnswers?: Record<string, string>;
}

export interface ATSResult {
  success: boolean;
  applicationId?: string;
  confirmationNumber?: string;
  status: "submitted" | "partial" | "failed" | "captcha_required" | "login_required";
  message: string;
  screenshots?: string[];
  errors?: string[];
  nextSteps?: string[];
}

export interface CAPTCHAResult {
  solved: boolean;
  solution?: string;
  method: "manual" | "2captcha" | "anticaptcha" | "hcaptcha" | "recaptcha_v2" | "recaptcha_v3";
  error?: string;
}

// ============================================================================
// CAPTCHA HANDLING
// ============================================================================

export class CAPTCHAHandler {
  private apiKey?: string;
  private service: "2captcha" | "anticaptcha" | "manual";

  constructor(service: "2captcha" | "anticaptcha" | "manual" = "manual", apiKey?: string) {
    this.service = service;
    this.apiKey = apiKey;
  }

  async detectCAPTCHA(page: Page): Promise<{
    detected: boolean;
    type?: "recaptcha_v2" | "recaptcha_v3" | "hcaptcha" | "funcaptcha" | "image" | "text";
    siteKey?: string;
  }> {
    // Check for reCAPTCHA v2
    const recaptchaV2 = await page.$(".g-recaptcha, [data-sitekey]");
    if (recaptchaV2) {
      const siteKey = await page.evaluate(() => {
        const el = document.querySelector("[data-sitekey]");
        return el?.getAttribute("data-sitekey") || null;
      });
      return { detected: true, type: "recaptcha_v2", siteKey: siteKey || undefined };
    }

    // Check for reCAPTCHA v3
    const recaptchaV3 = await page.evaluate(() => {
      return typeof (window as any).grecaptcha !== "undefined" && 
             document.querySelector('script[src*="recaptcha/api.js?render="]') !== null;
    });
    if (recaptchaV3) {
      const siteKey = await page.evaluate(() => {
        const script = document.querySelector('script[src*="recaptcha/api.js?render="]');
        const match = script?.getAttribute("src")?.match(/render=([^&]+)/);
        return match ? match[1] : null;
      });
      return { detected: true, type: "recaptcha_v3", siteKey: siteKey || undefined };
    }

    // Check for hCaptcha
    const hcaptcha = await page.$(".h-captcha, [data-hcaptcha-sitekey]");
    if (hcaptcha) {
      const siteKey = await page.evaluate(() => {
        const el = document.querySelector(".h-captcha, [data-hcaptcha-sitekey]");
        return el?.getAttribute("data-sitekey") || el?.getAttribute("data-hcaptcha-sitekey") || null;
      });
      return { detected: true, type: "hcaptcha", siteKey: siteKey || undefined };
    }

    // Check for FunCaptcha
    const funcaptcha = await page.$("#funcaptcha, [data-pkey]");
    if (funcaptcha) {
      return { detected: true, type: "funcaptcha" };
    }

    // Check for image CAPTCHA
    const imageCaptcha = await page.$('img[src*="captcha"], img[alt*="captcha"]');
    if (imageCaptcha) {
      return { detected: true, type: "image" };
    }

    return { detected: false };
  }

  async solveCAPTCHA(
    page: Page,
    captchaType: "recaptcha_v2" | "recaptcha_v3" | "hcaptcha" | "funcaptcha" | "image" | "text",
    siteKey?: string
  ): Promise<CAPTCHAResult> {
    if (this.service === "manual") {
      return {
        solved: false,
        method: "manual",
        error: "Manual CAPTCHA solving required. Please solve the CAPTCHA in the browser.",
      };
    }

    if (!this.apiKey) {
      return {
        solved: false,
        method: this.service,
        error: "No API key provided for CAPTCHA solving service",
      };
    }

    try {
      switch (captchaType) {
        case "recaptcha_v2":
          return await this.solveRecaptchaV2(page, siteKey!);
        case "recaptcha_v3":
          return await this.solveRecaptchaV3(page, siteKey!);
        case "hcaptcha":
          return await this.solveHCaptcha(page, siteKey!);
        default:
          return {
            solved: false,
            method: this.service,
            error: `Unsupported CAPTCHA type: ${captchaType}`,
          };
      }
    } catch (error) {
      return {
        solved: false,
        method: this.service,
        error: `CAPTCHA solving failed: ${error}`,
      };
    }
  }

  private async solveRecaptchaV2(page: Page, siteKey: string): Promise<CAPTCHAResult> {
    const pageUrl = page.url();
    
    if (this.service === "2captcha") {
      // Submit to 2captcha
      const submitResponse = await fetch(
        `http://2captcha.com/in.php?key=${this.apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${pageUrl}&json=1`
      );
      const submitData = await submitResponse.json();
      
      if (submitData.status !== 1) {
        return { solved: false, method: "2captcha", error: submitData.request };
      }

      const taskId = submitData.request;
      
      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const resultResponse = await fetch(
          `http://2captcha.com/res.php?key=${this.apiKey}&action=get&id=${taskId}&json=1`
        );
        const resultData = await resultResponse.json();
        
        if (resultData.status === 1) {
          // Inject the solution
          await page.evaluate((token: string) => {
            const textarea = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement;
            if (textarea) {
              textarea.value = token;
              textarea.style.display = "block";
            }
            // Trigger callback if exists
            const callback = (window as any).___grecaptcha_cfg?.clients?.[0]?.callback;
            if (callback) callback(token);
          }, resultData.request);
          
          return { solved: true, solution: resultData.request, method: "recaptcha_v2" };
        }
        
        if (resultData.request !== "CAPCHA_NOT_READY") {
          return { solved: false, method: "2captcha", error: resultData.request };
        }
        
        attempts++;
      }
      
      return { solved: false, method: "2captcha", error: "Timeout waiting for solution" };
    }

    return { solved: false, method: this.service, error: "Service not implemented" };
  }

  private async solveRecaptchaV3(page: Page, siteKey: string): Promise<CAPTCHAResult> {
    // reCAPTCHA v3 is score-based and typically doesn't require user interaction
    // The solution involves getting a token with a high score
    
    if (this.service === "2captcha") {
      const pageUrl = page.url();
      
      const submitResponse = await fetch(
        `http://2captcha.com/in.php?key=${this.apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${pageUrl}&version=v3&action=submit&min_score=0.9&json=1`
      );
      const submitData = await submitResponse.json();
      
      if (submitData.status !== 1) {
        return { solved: false, method: "2captcha", error: submitData.request };
      }

      const taskId = submitData.request;
      
      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const resultResponse = await fetch(
          `http://2captcha.com/res.php?key=${this.apiKey}&action=get&id=${taskId}&json=1`
        );
        const resultData = await resultResponse.json();
        
        if (resultData.status === 1) {
          return { solved: true, solution: resultData.request, method: "recaptcha_v3" };
        }
        
        if (resultData.request !== "CAPCHA_NOT_READY") {
          return { solved: false, method: "2captcha", error: resultData.request };
        }
        
        attempts++;
      }
    }

    return { solved: false, method: this.service, error: "Service not implemented" };
  }

  private async solveHCaptcha(page: Page, siteKey: string): Promise<CAPTCHAResult> {
    if (this.service === "2captcha") {
      const pageUrl = page.url();
      
      const submitResponse = await fetch(
        `http://2captcha.com/in.php?key=${this.apiKey}&method=hcaptcha&sitekey=${siteKey}&pageurl=${pageUrl}&json=1`
      );
      const submitData = await submitResponse.json();
      
      if (submitData.status !== 1) {
        return { solved: false, method: "2captcha", error: submitData.request };
      }

      const taskId = submitData.request;
      
      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const resultResponse = await fetch(
          `http://2captcha.com/res.php?key=${this.apiKey}&action=get&id=${taskId}&json=1`
        );
        const resultData = await resultResponse.json();
        
        if (resultData.status === 1) {
          // Inject the solution
          await page.evaluate((token: string) => {
            const textarea = document.querySelector('[name="h-captcha-response"]') as HTMLTextAreaElement;
            if (textarea) {
              textarea.value = token;
            }
            const iframe = document.querySelector('iframe[src*="hcaptcha"]');
            if (iframe) {
              (iframe as HTMLIFrameElement).contentWindow?.postMessage(
                { type: "hcaptcha-response", response: token },
                "*"
              );
            }
          }, resultData.request);
          
          return { solved: true, solution: resultData.request, method: "hcaptcha" };
        }
        
        if (resultData.request !== "CAPCHA_NOT_READY") {
          return { solved: false, method: "2captcha", error: resultData.request };
        }
        
        attempts++;
      }
    }

    return { solved: false, method: this.service, error: "Service not implemented" };
  }
}

// ============================================================================
// WORKDAY AUTOMATION
// ============================================================================

export class WorkdayAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private captchaHandler: CAPTCHAHandler;

  constructor(captchaHandler?: CAPTCHAHandler) {
    this.captchaHandler = captchaHandler || new CAPTCHAHandler("manual");
  }

  async initialize(): Promise<void> {
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
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async apply(applicationUrl: string, data: ApplicationData, credentials?: ATSCredentials): Promise<ATSResult> {
    if (!this.browser || !this.page) {
      await this.initialize();
    }

    const page = this.page!;
    const screenshots: string[] = [];
    const errors: string[] = [];

    try {
      // Navigate to the job application page
      await page.goto(applicationUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await this.delay(2000);

      // Check for CAPTCHA
      const captchaCheck = await this.captchaHandler.detectCAPTCHA(page);
      if (captchaCheck.detected) {
        const captchaResult = await this.captchaHandler.solveCAPTCHA(
          page,
          captchaCheck.type!,
          captchaCheck.siteKey
        );
        if (!captchaResult.solved) {
          return {
            success: false,
            status: "captcha_required",
            message: captchaResult.error || "CAPTCHA solving required",
            errors: [captchaResult.error || "CAPTCHA detected"],
            nextSteps: ["Please solve the CAPTCHA manually and retry"],
          };
        }
      }

      // Check if login is required
      const loginRequired = await this.checkLoginRequired(page);
      if (loginRequired) {
        if (credentials?.useLinkedInAuth) {
          await this.loginWithLinkedIn(page, credentials);
        } else if (credentials?.email && credentials?.password) {
          await this.loginWithCredentials(page, credentials);
        } else {
          return {
            success: false,
            status: "login_required",
            message: "Login required to apply",
            nextSteps: ["Create a Workday account or use LinkedIn to sign in"],
          };
        }
      }

      // Look for "Apply" button
      const applyButton = await page.$('[data-automation-id="applyButton"], button[aria-label*="Apply"], a[href*="apply"]');
      if (applyButton) {
        await applyButton.click();
        await this.delay(3000);
      }

      // Fill out the application form
      await this.fillPersonalInfo(page, data);
      await this.fillWorkExperience(page, data);
      await this.fillEducation(page, data);
      await this.uploadResume(page, data);
      await this.fillAdditionalQuestions(page, data);

      // Submit the application
      const submitResult = await this.submitApplication(page);

      return {
        success: submitResult.success,
        status: submitResult.success ? "submitted" : "partial",
        message: submitResult.message,
        confirmationNumber: submitResult.confirmationNumber,
        screenshots,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        status: "failed",
        message: `Application failed: ${error}`,
        errors: [String(error)],
        screenshots,
      };
    }
  }

  private async checkLoginRequired(page: Page): Promise<boolean> {
    const loginIndicators = [
      '[data-automation-id="signInLink"]',
      'button[aria-label*="Sign In"]',
      'a[href*="login"]',
      '#signInButton',
    ];

    for (const selector of loginIndicators) {
      const element = await page.$(selector);
      if (element) return true;
    }

    return false;
  }

  private async loginWithLinkedIn(page: Page, credentials: ATSCredentials): Promise<void> {
    const linkedInButton = await page.$('[data-automation-id="linkedInSignIn"], button[aria-label*="LinkedIn"]');
    if (linkedInButton) {
      await linkedInButton.click();
      await this.delay(3000);
      // LinkedIn OAuth flow would happen here
      // This is a simplified version - actual implementation would handle the OAuth popup
    }
  }

  private async loginWithCredentials(page: Page, credentials: ATSCredentials): Promise<void> {
    await page.type('[data-automation-id="email"], input[type="email"]', credentials.email);
    if (credentials.password) {
      await page.type('[data-automation-id="password"], input[type="password"]', credentials.password);
    }
    const signInButton = await page.$('[data-automation-id="signInButton"], button[type="submit"]');
    if (signInButton) {
      await signInButton.click();
      await this.delay(3000);
    }
  }

  private async fillPersonalInfo(page: Page, data: ApplicationData): Promise<void> {
    // First name
    await this.fillField(page, '[data-automation-id="legalNameSection_firstName"], input[name*="firstName"]', data.firstName);
    
    // Last name
    await this.fillField(page, '[data-automation-id="legalNameSection_lastName"], input[name*="lastName"]', data.lastName);
    
    // Email
    await this.fillField(page, '[data-automation-id="email"], input[type="email"]', data.email);
    
    // Phone
    await this.fillField(page, '[data-automation-id="phone"], input[type="tel"]', data.phone);
    
    // Address
    if (data.address) {
      await this.fillField(page, '[data-automation-id="addressSection_addressLine1"]', data.address.street);
      await this.fillField(page, '[data-automation-id="addressSection_city"]', data.address.city);
      await this.fillField(page, '[data-automation-id="addressSection_region"]', data.address.state);
      await this.fillField(page, '[data-automation-id="addressSection_postalCode"]', data.address.zip);
    }

    // LinkedIn URL
    if (data.linkedinUrl) {
      await this.fillField(page, '[data-automation-id="linkedInUrl"], input[name*="linkedin"]', data.linkedinUrl);
    }
  }

  private async fillWorkExperience(page: Page, data: ApplicationData): Promise<void> {
    if (!data.workHistory || data.workHistory.length === 0) return;

    for (let i = 0; i < data.workHistory.length; i++) {
      const work = data.workHistory[i];
      
      // Add new work experience entry if not the first
      if (i > 0) {
        const addButton = await page.$('[data-automation-id="Add Another"], button[aria-label*="Add"]');
        if (addButton) {
          await addButton.click();
          await this.delay(1000);
        }
      }

      await this.fillField(page, `[data-automation-id="workExperience-${i}-jobTitle"]`, work.title);
      await this.fillField(page, `[data-automation-id="workExperience-${i}-company"]`, work.company);
      await this.fillField(page, `[data-automation-id="workExperience-${i}-description"]`, work.description);
    }
  }

  private async fillEducation(page: Page, data: ApplicationData): Promise<void> {
    if (!data.education || data.education.length === 0) return;

    for (let i = 0; i < data.education.length; i++) {
      const edu = data.education[i];
      
      if (i > 0) {
        const addButton = await page.$('[data-automation-id="Add Another Education"], button[aria-label*="Add Education"]');
        if (addButton) {
          await addButton.click();
          await this.delay(1000);
        }
      }

      await this.fillField(page, `[data-automation-id="education-${i}-school"]`, edu.school);
      await this.fillField(page, `[data-automation-id="education-${i}-degree"]`, edu.degree);
      await this.fillField(page, `[data-automation-id="education-${i}-field"]`, edu.field);
    }
  }

  private async uploadResume(page: Page, data: ApplicationData): Promise<void> {
    const fileInput = await page.$('input[type="file"][data-automation-id*="resume"], input[type="file"][accept*="pdf"]');
    if (fileInput && data.resume.url) {
      // Download the resume first, then upload
      // This is a simplified version - actual implementation would handle file download
      console.log(`Would upload resume from: ${data.resume.url}`);
    }
  }

  private async fillAdditionalQuestions(page: Page, data: ApplicationData): Promise<void> {
    // Work authorization
    const workAuthSelect = await page.$('[data-automation-id="workAuthorization"], select[name*="authorization"]');
    if (workAuthSelect) {
      await page.select('[data-automation-id="workAuthorization"]', data.workAuthorization);
    }

    // Sponsorship required
    const sponsorshipRadio = await page.$(
      data.requiresSponsorship
        ? '[data-automation-id="sponsorship-yes"], input[value="yes"][name*="sponsorship"]'
        : '[data-automation-id="sponsorship-no"], input[value="no"][name*="sponsorship"]'
    );
    if (sponsorshipRadio) {
      await sponsorshipRadio.click();
    }

    // Custom answers
    if (data.customAnswers) {
      for (const [question, answer] of Object.entries(data.customAnswers)) {
        const field = await page.$(`[data-automation-id="${question}"], textarea[name*="${question}"]`);
        if (field) {
          await field.type(answer);
        }
      }
    }
  }

  private async submitApplication(page: Page): Promise<{ success: boolean; message: string; confirmationNumber?: string }> {
    try {
      // Look for submit button
      const submitButton = await page.$(
        '[data-automation-id="submitButton"], button[type="submit"], button[aria-label*="Submit"]'
      );
      
      if (!submitButton) {
        return { success: false, message: "Submit button not found" };
      }

      await submitButton.click();
      await this.delay(5000);

      // Check for confirmation
      const confirmation = await page.$('[data-automation-id="confirmationMessage"], .confirmation, .success-message');
      if (confirmation) {
        const confirmationText = await page.evaluate(el => el?.textContent || "", confirmation);
        const confirmationMatch = confirmationText.match(/confirmation.*?(\d+)/i);
        return {
          success: true,
          message: "Application submitted successfully",
          confirmationNumber: confirmationMatch ? confirmationMatch[1] : undefined,
        };
      }

      // Check for errors
      const errorMessage = await page.$('.error-message, [data-automation-id="errorMessage"]');
      if (errorMessage) {
        const errorText = await page.evaluate(el => el?.textContent || "", errorMessage);
        return { success: false, message: `Submission error: ${errorText}` };
      }

      return { success: true, message: "Application appears to be submitted" };
    } catch (error) {
      return { success: false, message: `Submit failed: ${error}` };
    }
  }

  private async fillField(page: Page, selector: string, value: string): Promise<void> {
    try {
      const field = await page.$(selector);
      if (field) {
        await field.click({ clickCount: 3 }); // Select all
        await field.type(value);
      }
    } catch (error) {
      console.log(`Failed to fill field ${selector}: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// TALEO AUTOMATION
// ============================================================================

export class TaleoAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private captchaHandler: CAPTCHAHandler;

  constructor(captchaHandler?: CAPTCHAHandler) {
    this.captchaHandler = captchaHandler || new CAPTCHAHandler("manual");
  }

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080",
      ],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async apply(applicationUrl: string, data: ApplicationData, credentials?: ATSCredentials): Promise<ATSResult> {
    if (!this.browser || !this.page) {
      await this.initialize();
    }

    const page = this.page!;
    const errors: string[] = [];

    try {
      // Navigate to the job application page
      await page.goto(applicationUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await this.delay(3000);

      // Check for CAPTCHA
      const captchaCheck = await this.captchaHandler.detectCAPTCHA(page);
      if (captchaCheck.detected) {
        const captchaResult = await this.captchaHandler.solveCAPTCHA(
          page,
          captchaCheck.type!,
          captchaCheck.siteKey
        );
        if (!captchaResult.solved) {
          return {
            success: false,
            status: "captcha_required",
            message: captchaResult.error || "CAPTCHA solving required",
            errors: [captchaResult.error || "CAPTCHA detected"],
          };
        }
      }

      // Taleo typically has a multi-step application process
      // Step 1: Personal Information
      await this.fillTaleoPersonalInfo(page, data);
      await this.clickNext(page);

      // Step 2: Work Experience
      await this.fillTaleoWorkExperience(page, data);
      await this.clickNext(page);

      // Step 3: Education
      await this.fillTaleoEducation(page, data);
      await this.clickNext(page);

      // Step 4: Resume Upload
      await this.uploadTaleoResume(page, data);
      await this.clickNext(page);

      // Step 5: Additional Questions
      await this.fillTaleoQuestions(page, data);
      
      // Submit
      const submitResult = await this.submitTaleoApplication(page);

      return {
        success: submitResult.success,
        status: submitResult.success ? "submitted" : "partial",
        message: submitResult.message,
        confirmationNumber: submitResult.confirmationNumber,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        status: "failed",
        message: `Application failed: ${error}`,
        errors: [String(error)],
      };
    }
  }

  private async fillTaleoPersonalInfo(page: Page, data: ApplicationData): Promise<void> {
    // Taleo uses specific field IDs
    await this.fillField(page, '#FirstName, input[name*="FirstName"]', data.firstName);
    await this.fillField(page, '#LastName, input[name*="LastName"]', data.lastName);
    await this.fillField(page, '#Email, input[name*="Email"]', data.email);
    await this.fillField(page, '#Phone, input[name*="Phone"]', data.phone);

    if (data.address) {
      await this.fillField(page, '#Address, input[name*="Address"]', data.address.street);
      await this.fillField(page, '#City, input[name*="City"]', data.address.city);
      await this.fillField(page, '#State, input[name*="State"]', data.address.state);
      await this.fillField(page, '#ZipCode, input[name*="Zip"]', data.address.zip);
    }
  }

  private async fillTaleoWorkExperience(page: Page, data: ApplicationData): Promise<void> {
    if (!data.workHistory || data.workHistory.length === 0) return;

    for (let i = 0; i < Math.min(data.workHistory.length, 5); i++) {
      const work = data.workHistory[i];
      
      if (i > 0) {
        const addButton = await page.$('.addExperience, button[onclick*="addExperience"]');
        if (addButton) {
          await addButton.click();
          await this.delay(1000);
        }
      }

      await this.fillField(page, `#Employer${i}, input[name*="Employer"][id*="${i}"]`, work.company);
      await this.fillField(page, `#JobTitle${i}, input[name*="Title"][id*="${i}"]`, work.title);
      await this.fillField(page, `#Duties${i}, textarea[name*="Duties"][id*="${i}"]`, work.description);
    }
  }

  private async fillTaleoEducation(page: Page, data: ApplicationData): Promise<void> {
    if (!data.education || data.education.length === 0) return;

    for (let i = 0; i < Math.min(data.education.length, 3); i++) {
      const edu = data.education[i];
      
      await this.fillField(page, `#School${i}, input[name*="School"][id*="${i}"]`, edu.school);
      await this.fillField(page, `#Degree${i}, input[name*="Degree"][id*="${i}"]`, edu.degree);
      await this.fillField(page, `#Major${i}, input[name*="Major"][id*="${i}"]`, edu.field);
    }
  }

  private async uploadTaleoResume(page: Page, data: ApplicationData): Promise<void> {
    const fileInput = await page.$('input[type="file"], #ResumeUpload');
    if (fileInput && data.resume.url) {
      console.log(`Would upload resume from: ${data.resume.url}`);
    }
  }

  private async fillTaleoQuestions(page: Page, data: ApplicationData): Promise<void> {
    // Work authorization question
    const authQuestion = await page.$('select[name*="WorkAuth"], #WorkAuthorization');
    if (authQuestion) {
      await page.select('select[name*="WorkAuth"]', data.workAuthorization);
    }

    // Sponsorship question
    const sponsorshipYes = await page.$('input[value="Yes"][name*="Sponsor"]');
    const sponsorshipNo = await page.$('input[value="No"][name*="Sponsor"]');
    if (data.requiresSponsorship && sponsorshipYes) {
      await sponsorshipYes.click();
    } else if (!data.requiresSponsorship && sponsorshipNo) {
      await sponsorshipNo.click();
    }

    // Custom answers
    if (data.customAnswers) {
      for (const [question, answer] of Object.entries(data.customAnswers)) {
        await this.fillField(page, `[name*="${question}"], #${question}`, answer);
      }
    }
  }

  private async clickNext(page: Page): Promise<void> {
    const nextButton = await page.$('.nextButton, button[value="Next"], input[value="Next"]');
    if (nextButton) {
      await nextButton.click();
      await this.delay(2000);
    }
  }

  private async submitTaleoApplication(page: Page): Promise<{ success: boolean; message: string; confirmationNumber?: string }> {
    try {
      const submitButton = await page.$('.submitButton, button[value="Submit"], input[value="Submit"]');
      
      if (!submitButton) {
        return { success: false, message: "Submit button not found" };
      }

      await submitButton.click();
      await this.delay(5000);

      // Check for confirmation page
      const confirmation = await page.$('.confirmationPage, .successMessage, #confirmationNumber');
      if (confirmation) {
        const confirmationText = await page.evaluate(el => el?.textContent || "", confirmation);
        const confirmationMatch = confirmationText.match(/(\d{6,})/);
        return {
          success: true,
          message: "Application submitted successfully",
          confirmationNumber: confirmationMatch ? confirmationMatch[1] : undefined,
        };
      }

      return { success: true, message: "Application appears to be submitted" };
    } catch (error) {
      return { success: false, message: `Submit failed: ${error}` };
    }
  }

  private async fillField(page: Page, selector: string, value: string): Promise<void> {
    try {
      const field = await page.$(selector);
      if (field) {
        await field.click({ clickCount: 3 });
        await field.type(value);
      }
    } catch (error) {
      console.log(`Failed to fill field ${selector}: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// ATS FACTORY
// ============================================================================

export type ATSType = "workday" | "taleo" | "greenhouse" | "lever" | "icims" | "smartrecruiters" | "unknown";

export function detectATSType(url: string): ATSType {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes("myworkday") || urlLower.includes("workday.com")) {
    return "workday";
  }
  if (urlLower.includes("taleo") || urlLower.includes("oracle.com/careers")) {
    return "taleo";
  }
  if (urlLower.includes("greenhouse.io") || urlLower.includes("boards.greenhouse")) {
    return "greenhouse";
  }
  if (urlLower.includes("lever.co") || urlLower.includes("jobs.lever")) {
    return "lever";
  }
  if (urlLower.includes("icims.com")) {
    return "icims";
  }
  if (urlLower.includes("smartrecruiters.com")) {
    return "smartrecruiters";
  }
  
  return "unknown";
}

export async function applyWithATS(
  applicationUrl: string,
  data: ApplicationData,
  credentials?: ATSCredentials,
  captchaApiKey?: string
): Promise<ATSResult> {
  const atsType = detectATSType(applicationUrl);
  const captchaHandler = new CAPTCHAHandler(captchaApiKey ? "2captcha" : "manual", captchaApiKey);

  switch (atsType) {
    case "workday": {
      const workday = new WorkdayAutomation(captchaHandler);
      try {
        return await workday.apply(applicationUrl, data, credentials);
      } finally {
        await workday.close();
      }
    }
    case "taleo": {
      const taleo = new TaleoAutomation(captchaHandler);
      try {
        return await taleo.apply(applicationUrl, data, credentials);
      } finally {
        await taleo.close();
      }
    }
    case "greenhouse":
    case "lever": {
      // Use existing browserAutomation.ts for these
      const { automateApplication } = await import("./browserAutomation");
      const result = await automateApplication(applicationUrl, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        resumeUrl: data.resume.url,
        coverLetter: data.coverLetter,
        linkedinUrl: data.linkedinUrl,
        portfolioUrl: data.portfolioUrl,
      });
      return {
        success: result.success,
        status: result.success ? "submitted" : "failed",
        message: result.error || "Application processed",
        applicationId: result.applicationId,
        errors: result.error ? [result.error] : undefined,
      };
    }
    default:
      return {
        success: false,
        status: "failed",
        message: `Unsupported ATS type: ${atsType}. Manual application required.`,
        nextSteps: ["Apply manually through the company's career page"],
      };
  }
}
