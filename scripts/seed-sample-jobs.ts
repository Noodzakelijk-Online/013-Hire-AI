/**
 * Seed script to populate the database with sample jobs
 * Run with: pnpm exec tsx scripts/seed-sample-jobs.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import { jobs, jobPlatforms } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const sampleJobs = [
  // Software Engineering
  {
    title: "Senior Full Stack Developer",
    company: "TechFlow Inc",
    location: "Remote - Worldwide",
    description: "We're looking for a Senior Full Stack Developer to join our growing team. You'll work on building scalable web applications using React, Node.js, and PostgreSQL. Experience with cloud services (AWS/GCP) is a plus.",
    requirements: "5+ years of experience with JavaScript/TypeScript, React, Node.js, SQL databases, REST APIs, Git",
    salary: "$120,000 - $160,000",
    jobType: "full-time" as const,
    experienceLevel: "senior",
    skills: "JavaScript, TypeScript, React, Node.js, PostgreSQL, AWS, Docker",
    benefits: "Health insurance, 401k matching, unlimited PTO, remote work, learning budget",
    applicationUrl: "https://techflow.example.com/careers/senior-fullstack",
    postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
  {
    title: "Frontend Engineer",
    company: "DesignHub",
    location: "Remote - US Only",
    description: "Join our design-focused team to build beautiful, accessible user interfaces. We use React, TypeScript, and Tailwind CSS to create pixel-perfect experiences.",
    requirements: "3+ years of frontend development, strong CSS skills, accessibility knowledge, design system experience",
    salary: "$100,000 - $130,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "React, TypeScript, CSS, Tailwind, Figma, Accessibility, Testing",
    benefits: "Medical/dental/vision, equity, flexible hours, home office stipend",
    applicationUrl: "https://designhub.example.com/jobs/frontend",
    postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    title: "Backend Python Developer",
    company: "DataStream Analytics",
    location: "Remote - Europe",
    description: "Build robust data pipelines and APIs for our analytics platform. Work with Python, FastAPI, and various databases to process millions of events daily.",
    requirements: "4+ years Python experience, FastAPI/Django, PostgreSQL, Redis, message queues",
    salary: "€80,000 - €110,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "Python, FastAPI, PostgreSQL, Redis, Kafka, Docker, Kubernetes",
    benefits: "Remote-first, 30 days PTO, conference budget, equipment allowance",
    applicationUrl: "https://datastream.example.com/careers/backend-python",
    postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    title: "DevOps Engineer",
    company: "CloudScale Systems",
    location: "Remote - Worldwide",
    description: "Help us scale our infrastructure to handle 10x growth. You'll work on CI/CD pipelines, Kubernetes clusters, and monitoring systems.",
    requirements: "3+ years DevOps/SRE experience, Kubernetes, Terraform, CI/CD, monitoring tools",
    salary: "$130,000 - $170,000",
    jobType: "full-time" as const,
    experienceLevel: "senior",
    skills: "Kubernetes, Terraform, AWS, Docker, GitHub Actions, Prometheus, Grafana",
    benefits: "Fully remote, stock options, unlimited PTO, health benefits",
    applicationUrl: "https://cloudscale.example.com/jobs/devops",
    postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Junior React Developer",
    company: "StartupLaunch",
    location: "Remote - US/Canada",
    description: "Great opportunity for a junior developer to grow! You'll work alongside senior engineers building our SaaS platform. Mentorship included.",
    requirements: "1+ years React experience, JavaScript fundamentals, willingness to learn",
    salary: "$60,000 - $80,000",
    jobType: "full-time" as const,
    experienceLevel: "junior",
    skills: "React, JavaScript, HTML, CSS, Git",
    benefits: "Health insurance, mentorship program, learning budget, flexible schedule",
    applicationUrl: "https://startuplaunch.example.com/careers/junior-react",
    postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  // Product & Design
  {
    title: "Senior Product Designer",
    company: "UXFirst",
    location: "Remote - Worldwide",
    description: "Lead the design of our B2B SaaS product. You'll conduct user research, create wireframes and prototypes, and work closely with engineering.",
    requirements: "5+ years product design experience, Figma expertise, user research skills",
    salary: "$110,000 - $150,000",
    jobType: "full-time" as const,
    experienceLevel: "senior",
    skills: "Figma, User Research, Prototyping, Design Systems, Usability Testing",
    benefits: "Remote work, equity, unlimited PTO, design conference budget",
    applicationUrl: "https://uxfirst.example.com/careers/senior-designer",
    postedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Product Manager",
    company: "GrowthTech",
    location: "Remote - US",
    description: "Own the product roadmap for our growth team. You'll work with data to identify opportunities and ship features that drive user acquisition.",
    requirements: "3+ years PM experience, data-driven mindset, B2B SaaS background preferred",
    salary: "$130,000 - $160,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "Product Strategy, Data Analysis, Agile, User Research, SQL",
    benefits: "Competitive salary, equity, health benefits, remote work",
    applicationUrl: "https://growthtech.example.com/jobs/pm",
    postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  // Data & AI
  {
    title: "Machine Learning Engineer",
    company: "AI Innovations",
    location: "Remote - Worldwide",
    description: "Build and deploy ML models for our recommendation engine. Work with large datasets and cutting-edge NLP techniques.",
    requirements: "3+ years ML experience, Python, PyTorch/TensorFlow, NLP experience",
    salary: "$150,000 - $200,000",
    jobType: "full-time" as const,
    experienceLevel: "senior",
    skills: "Python, PyTorch, TensorFlow, NLP, MLOps, AWS SageMaker",
    benefits: "Top-tier compensation, equity, research time, conference attendance",
    applicationUrl: "https://aiinnovations.example.com/careers/ml-engineer",
    postedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Data Analyst",
    company: "InsightCo",
    location: "Remote - US/Europe",
    description: "Turn data into actionable insights for our business teams. You'll build dashboards, run analyses, and present findings to stakeholders.",
    requirements: "2+ years data analysis, SQL, Python or R, visualization tools",
    salary: "$80,000 - $110,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "SQL, Python, Tableau, Looker, Statistics, Excel",
    benefits: "Remote work, health insurance, professional development budget",
    applicationUrl: "https://insightco.example.com/jobs/data-analyst",
    postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  // Marketing & Content
  {
    title: "Content Marketing Manager",
    company: "ContentFirst",
    location: "Remote - Worldwide",
    description: "Lead our content strategy and grow our organic traffic. You'll manage a team of writers and work closely with SEO and product teams.",
    requirements: "4+ years content marketing, SEO knowledge, team management experience",
    salary: "$90,000 - $120,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "Content Strategy, SEO, Copywriting, Analytics, Team Leadership",
    benefits: "Fully remote, flexible hours, health benefits, learning budget",
    applicationUrl: "https://contentfirst.example.com/careers/content-manager",
    postedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Growth Marketing Specialist",
    company: "ScaleUp",
    location: "Remote - US",
    description: "Drive user acquisition through paid and organic channels. You'll run experiments, optimize campaigns, and scale what works.",
    requirements: "2+ years growth/performance marketing, paid ads experience, analytics skills",
    salary: "$70,000 - $95,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "Google Ads, Facebook Ads, Analytics, A/B Testing, SEO",
    benefits: "Remote work, equity, unlimited PTO, marketing tool budget",
    applicationUrl: "https://scaleup.example.com/jobs/growth",
    postedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  // Customer Success & Support
  {
    title: "Customer Success Manager",
    company: "SaaSPro",
    location: "Remote - US/Canada",
    description: "Own relationships with our enterprise customers. You'll drive adoption, reduce churn, and identify expansion opportunities.",
    requirements: "3+ years CSM experience, B2B SaaS background, excellent communication",
    salary: "$85,000 - $115,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "Customer Success, Account Management, SaaS, CRM, Communication",
    benefits: "Remote work, health benefits, commission structure, career growth",
    applicationUrl: "https://saaspro.example.com/careers/csm",
    postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  // Contract/Freelance
  {
    title: "Contract React Native Developer",
    company: "MobileFirst Agency",
    location: "Remote - Worldwide",
    description: "6-month contract to build a new mobile app from scratch. Possibility of extension or conversion to full-time.",
    requirements: "3+ years React Native, published apps, TypeScript",
    salary: "$80 - $120/hour",
    jobType: "contract" as const,
    experienceLevel: "senior",
    skills: "React Native, TypeScript, iOS, Android, REST APIs",
    benefits: "Flexible schedule, remote work, potential for full-time conversion",
    applicationUrl: "https://mobilefirst.example.com/contract/rn-dev",
    postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Part-Time Technical Writer",
    company: "DocuTech",
    location: "Remote - Worldwide",
    description: "Write technical documentation for our developer tools. 20 hours/week with flexible scheduling.",
    requirements: "2+ years technical writing, developer background preferred",
    salary: "$40 - $60/hour",
    jobType: "part-time" as const,
    experienceLevel: "mid",
    skills: "Technical Writing, Markdown, API Documentation, Developer Tools",
    benefits: "Flexible hours, remote work, interesting technical content",
    applicationUrl: "https://docutech.example.com/jobs/tech-writer",
    postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  // More Engineering Roles
  {
    title: "Staff Software Engineer",
    company: "EnterpriseCloud",
    location: "Remote - US",
    description: "Lead technical initiatives across multiple teams. You'll architect solutions, mentor engineers, and drive engineering excellence.",
    requirements: "8+ years software engineering, system design expertise, leadership experience",
    salary: "$180,000 - $250,000",
    jobType: "full-time" as const,
    experienceLevel: "senior",
    skills: "System Design, Java, Microservices, Leadership, Architecture",
    benefits: "Top compensation, equity, sabbatical, executive benefits",
    applicationUrl: "https://enterprisecloud.example.com/careers/staff-engineer",
    postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    title: "iOS Developer",
    company: "AppWorks Studio",
    location: "Remote - Europe",
    description: "Build beautiful iOS apps using Swift and SwiftUI. Work on consumer-facing products used by millions.",
    requirements: "3+ years iOS development, Swift, SwiftUI, App Store experience",
    salary: "€70,000 - €100,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "Swift, SwiftUI, iOS, Xcode, Core Data, REST APIs",
    benefits: "Remote work, latest MacBook, conference budget, flexible hours",
    applicationUrl: "https://appworks.example.com/jobs/ios",
    postedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Blockchain Developer",
    company: "Web3 Labs",
    location: "Remote - Worldwide",
    description: "Build decentralized applications on Ethereum and other chains. Work on DeFi protocols and smart contracts.",
    requirements: "2+ years blockchain development, Solidity, Web3.js, DeFi experience",
    salary: "$140,000 - $200,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "Solidity, Ethereum, Web3.js, Smart Contracts, DeFi",
    benefits: "Token compensation, fully remote, cutting-edge tech",
    applicationUrl: "https://web3labs.example.com/careers/blockchain",
    postedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },
  {
    title: "QA Engineer",
    company: "QualityFirst",
    location: "Remote - US/Canada",
    description: "Ensure our product quality through manual and automated testing. Build test frameworks and work closely with developers.",
    requirements: "3+ years QA experience, automation skills, attention to detail",
    salary: "$80,000 - $110,000",
    jobType: "full-time" as const,
    experienceLevel: "mid",
    skills: "Test Automation, Selenium, Cypress, API Testing, Agile",
    benefits: "Remote work, health insurance, professional development",
    applicationUrl: "https://qualityfirst.example.com/jobs/qa",
    postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Security Engineer",
    company: "SecureNet",
    location: "Remote - Worldwide",
    description: "Protect our infrastructure and applications from threats. Conduct security audits, implement controls, and respond to incidents.",
    requirements: "4+ years security experience, penetration testing, cloud security",
    salary: "$140,000 - $180,000",
    jobType: "full-time" as const,
    experienceLevel: "senior",
    skills: "Security, Penetration Testing, AWS Security, SIEM, Compliance",
    benefits: "Competitive salary, equity, conference budget, certification support",
    applicationUrl: "https://securenet.example.com/careers/security",
    postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    title: "Database Administrator",
    company: "DataCore",
    location: "Remote - US",
    description: "Manage and optimize our PostgreSQL and MySQL databases. Ensure high availability, performance, and data integrity.",
    requirements: "5+ years DBA experience, PostgreSQL, MySQL, performance tuning",
    salary: "$110,000 - $145,000",
    jobType: "full-time" as const,
    experienceLevel: "senior",
    skills: "PostgreSQL, MySQL, Database Optimization, Backup/Recovery, Replication",
    benefits: "Remote work, health benefits, on-call compensation",
    applicationUrl: "https://datacore.example.com/jobs/dba",
    postedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

async function seedJobs() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL);

  console.log("🌱 Seeding sample jobs...\n");

  // Get platform IDs
  const platforms = await db.select().from(jobPlatforms);
  const platformMap = new Map(platforms.map(p => [p.name, p.id]));
  
  // Use RemoteOK as default platform, or first available
  const defaultPlatformId = platformMap.get("RemoteOK") || platforms[0]?.id || 1;

  let inserted = 0;
  for (const job of sampleJobs) {
    try {
      // Check if job already exists
      const existing = await db.select()
        .from(jobs)
        .where(eq(jobs.title, job.title))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`⏭️  Skipping existing job: ${job.title}`);
        continue;
      }

      await db.insert(jobs).values({
        ...job,
        platformId: defaultPlatformId,
        externalId: `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: "active",
      });
      
      console.log(`✅ Added: ${job.title} at ${job.company}`);
      inserted++;
    } catch (error) {
      console.error(`❌ Failed to add ${job.title}:`, error);
    }
  }

  console.log(`\n🎉 Seeding complete! Added ${inserted} new jobs.`);
  process.exit(0);
}

seedJobs().catch(console.error);
