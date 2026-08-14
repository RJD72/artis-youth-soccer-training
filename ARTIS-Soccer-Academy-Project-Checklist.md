# ARTIS Soccer Academy — Complete Project Checklist

Last updated: August 14, 2026

## Status key

- [x] Complete or already confirmed
- [ ] Not complete
- **IN PROGRESS** means work has begun, but the phase is not finished
- **CLIENT DEPENDENCY** means ARTIS must provide or approve it

---

## Phase 1 — Discovery and project definition — IN PROGRESS

### Business requirements

- [x] Hold initial client discovery meeting
- [x] Confirm that the business is a youth soccer training academy
- [x] Identify the primary audience as parents/guardians of youth players
- [x] Identify the two initial age groups: ages 8–10 and ages 11–14
- [x] Establish an expected capacity of approximately 30 players per group
- [x] Confirm that training is expected three times per week
- [x] Confirm that the weekly schedule will normally be fixed
- [x] Confirm one-, three-, six-, and twelve-month training packages
- [x] Confirm that packages are one-time purchases and do not automatically renew
- [x] Confirm that longer packages should receive larger discounts
- [x] Confirm that parents—not children—will complete registration
- [x] Confirm the need for parent, child, emergency-contact, medical, and allergy information
- [x] Confirm the need for waiver acceptance
- [x] Confirm the need for automatic confirmation email and receipt
- [x] Confirm the need for a waitlist when a group is full
- [x] Confirm Stripe as the intended payment processor
- [x] Confirm that the owners need access to customer and registration information
- [x] Agree that the launch can begin with a focused first version and expand later
- [ ] Confirm the exact list of MVP features with the client
- [ ] Record features explicitly postponed until after launch
- [ ] Obtain written approval of the final project scope

### Outstanding client decisions — CLIENT DEPENDENCY

- [ ] Confirm final facility approval and address
- [ ] Confirm final training days and times for both groups
- [ ] Confirm exact capacity for each training group
- [ ] Confirm whether capacity is based on active paid players rather than all historical registrations
- [ ] Confirm final package prices and discounts
- [ ] Confirm package start-date and expiry rules
- [ ] Confirm how much time a parent has to complete payment before a temporary spot is released
- [ ] Confirm cancellation and refund rules
- [ ] Confirm absence, missed-class, and make-up-session rules if applicable
- [ ] Confirm waitlist operating procedure
- [ ] Confirm what happens when a package expires and is not renewed
- [ ] Confirm what happens when a player leaves early
- [ ] Confirm who is authorized to access the admin dashboard
- [ ] Confirm which content the owners must be able to edit themselves
- [ ] Confirm the production launch date

---

## Phase 2 — Content, branding, and legal material — IN PROGRESS

### Content collection

- [x] Receive the ARTIS logo
- [x] Send the client an email requesting website content and images
- [ ] Receive academy/business description — **CLIENT DEPENDENCY**
- [ ] Receive coach names, biographies, qualifications, and headshots — **CLIENT DEPENDENCY**
- [ ] Receive program descriptions — **CLIENT DEPENDENCY**
- [ ] Receive final contact details — **CLIENT DEPENDENCY**
- [ ] Receive business hours or preferred contact hours — **CLIENT DEPENDENCY**
- [ ] Receive social-media links — **CLIENT DEPENDENCY**
- [ ] Receive photographs and permission to publish them — **CLIENT DEPENDENCY**
- [ ] Confirm whether identifiable children appear in any photographs and obtain appropriate permission — **CLIENT DEPENDENCY**
- [ ] Organize received content by website section
- [ ] Edit copy for clarity, grammar, consistency, and search intent
- [ ] Return materially changed copy to the client for approval
- [ ] Optimize, resize, rename, and compress production images
- [ ] Write alternative text for meaningful images

### Branding

- [x] Establish a modern, minimalist visual direction
- [x] Create an initial colour-scheme direction based on the ARTIS brand
- [ ] Confirm final colour palette with client
- [ ] Confirm final typography
- [ ] Obtain high-resolution/vector logo files if available
- [ ] Prepare web-ready logo, favicon, and social-sharing image
- [ ] Document reusable design tokens: colours, typography, spacing, borders, and shadows

### Legal and policy content — CLIENT DEPENDENCY

- [ ] Receive lawyer-reviewed waiver
- [ ] Receive cancellation/refund policy
- [ ] Prepare privacy policy suited to the actual information collected
- [ ] Prepare website terms/registration terms if required
- [ ] Confirm consent wording for medical and emergency-contact information
- [ ] Confirm permission wording for email communications
- [ ] Confirm photo/video consent requirements, if photography will occur
- [ ] Add policy version numbers or effective dates
- [ ] Obtain client approval of every legal/policy page before launch

---

## Phase 3 — Technical foundation — IN PROGRESS

### Architecture and stack

- [x] Select Next.js as the full-stack application framework
- [x] Select TypeScript
- [x] Select Tailwind CSS for styling
- [x] Select MySQL as the database
- [x] Select Drizzle ORM and Drizzle Kit
- [x] Select Stripe Checkout for payments
- [x] Plan to host the application using the client’s Hostinger-compatible setup
- [ ] Select and document the authentication solution for administrators
- [ ] Select and document the transactional email service
- [ ] Select validation library and shared validation approach
- [ ] Select production logging/error-monitoring approach
- [ ] Document the final architecture and major data flows

### Project setup

- [x] Create the application project
- [x] Install Drizzle ORM, Drizzle Kit, MySQL2, dotenv, and tsx
- [x] Configure a local database connection string
- [x] Correct the original malformed database connection URL
- [x] Create and successfully run a database connection test
- [x] Configure the initial Drizzle schema workflow
- [x] Commit the initial database work
- [ ] Confirm linting configuration passes
- [ ] Confirm TypeScript type checking passes
- [ ] Add automated test framework if not already present
- [ ] Create `.env.example` with names only—no secrets
- [ ] Document local setup and database commands in the README
- [ ] Confirm development, test, and production environment separation

### Security foundation

- [ ] Inventory every secret and environment variable
- [ ] Ensure secrets are never exposed through client-side environment variables
- [ ] Add secure HTTP/security headers
- [ ] Define server-side input-validation rules
- [ ] Plan CSRF protection where applicable
- [ ] Plan rate limiting for public forms and sensitive endpoints
- [ ] Add bot/spam protection or a honeypot to public forms
- [ ] Define access-control rules for all admin routes and server actions
- [ ] Define database backup and recovery expectations
- [ ] Define retention/deletion rules for personal and medical information

---

## Phase 4 — Database design and implementation — IN PROGRESS

### Completed foundation

- [x] Create the `training_groups` schema
- [x] Add training-group ID, slug, display name, age range, capacity, and registration-open fields
- [x] Add created and updated timestamps to training groups
- [x] Add a unique constraint for the training-group slug
- [x] Generate the initial `training_groups` SQL migration
- [x] Resolve Drizzle/MySQL type errors encountered during the initial schema work

### Remaining schema

- [ ] Draw the complete entity-relationship/data model before adding the remaining tables
- [ ] Create `packages` table
- [ ] Create `parents` or `guardians` table
- [ ] Create `players` table
- [ ] Create emergency-contact storage
- [ ] Create `registrations` table
- [ ] Create package-purchase or enrolment-period records
- [ ] Create `payments` table
- [ ] Create `waiver_acceptances` table with waiver version and timestamp
- [ ] Create `waitlist_entries` table
- [ ] Create admin-user/authentication records if required by the chosen auth solution
- [ ] Define active, pending, expired, cancelled, refunded, waitlisted, and completed statuses
- [ ] Use status/history rather than deleting former registrations
- [ ] Add package start and expiry dates
- [ ] Add audit timestamps to all operational records
- [ ] Add appropriate foreign keys
- [ ] Add unique constraints where duplicate records would be harmful
- [ ] Add indexes for common searches and admin filters
- [ ] Decide how sensitive medical data will be protected and exposed
- [ ] Generate and inspect migrations
- [ ] Apply migrations to the development database
- [ ] Create seed data for both age groups and sample packages
- [ ] Create realistic test parents, players, registrations, payments, and waitlist entries
- [ ] Test database relationships and deletion/update restrictions
- [ ] Test capacity-count queries using active paid enrolments only
- [ ] Test package-expiry queries
- [ ] Document how migrations will be applied in production

---

## Phase 5 — UX/UI design — IN PROGRESS

### Wireframes and mockups

- [x] Create an initial modern/minimalist design direction
- [x] Design core desktop screens in Figma
- [x] Design core mobile screens in Figma
- [x] Create a parent-and-child registration-form design for desktop
- [x] Create a parent-and-child registration-form design for mobile
- [x] Create a mock Stripe payment screen
- [x] Create payment-success and/or unsuccessful-payment concepts
- [ ] Add the admin dashboard/customer-list screens to the design
- [ ] Add waitlist state and waitlist form to the design
- [ ] Add full-group/registration-closed states
- [ ] Add form validation and error states
- [ ] Add loading and submission states
- [ ] Add empty states for the admin dashboard
- [ ] Review every screen for responsive behaviour
- [ ] Review colour contrast, typography size, focus states, and accessibility
- [ ] Present the first design draft to the client
- [ ] Gather client feedback
- [ ] Revise design
- [ ] Obtain written design approval before extensive polishing

---

## Phase 6 — Public website implementation

### Shared layout and components

- [ ] Build the global header and navigation
- [ ] Build the global footer
- [ ] Build reusable buttons, cards, form controls, notices, and modal/dialog components
- [ ] Implement responsive layout rules
- [ ] Implement final design tokens
- [ ] Add accessible focus, hover, active, disabled, and error states
- [ ] Add site-wide error and not-found pages

### Public pages/sections

- [ ] Build home/landing page
- [ ] Build academy/about section
- [ ] Build coach/team section
- [ ] Build programs and age-groups section
- [ ] Build schedule section
- [ ] Build package/pricing section
- [ ] Build contact section/form
- [ ] Build FAQ section if approved
- [ ] Build privacy-policy page
- [ ] Build waiver page or review step
- [ ] Build cancellation/refund-policy page
- [ ] Build registration-closed/full-group messaging
- [ ] Build waitlist page/form
- [ ] Replace temporary content with client-approved content
- [ ] Replace placeholders with optimized final images

---

## Phase 7 — Registration system

### Form implementation

- [ ] Define every registration field and map it to the database
- [ ] Decide which fields are required, optional, or conditionally shown
- [ ] Build age-group selection
- [ ] Build package selection
- [ ] Build parent/guardian information step
- [ ] Build player information step
- [ ] Build emergency-contact step
- [ ] Build medical/allergy information step
- [ ] Build consent, waiver, and policy-acceptance step
- [ ] Build review-before-payment step
- [ ] Add client-side validation for usability
- [ ] Add matching server-side validation for security and data integrity
- [ ] Prevent impossible or invalid dates of birth
- [ ] Confirm the player fits the selected group’s age rules
- [ ] Normalize email addresses and phone numbers
- [ ] Protect against duplicate submissions
- [ ] Add accessible validation summaries and field errors
- [ ] Preserve appropriate form data when a correctable error occurs

### Registration lifecycle

- [ ] Create a pending registration before redirecting to payment
- [ ] Generate a unique registration reference
- [ ] Create a temporary capacity hold while checkout is active
- [ ] Expire abandoned capacity holds safely
- [ ] Confirm a registration only after verified payment
- [ ] Calculate package expiry date from the confirmed start date
- [ ] Keep expired/cancelled registrations as historical records
- [ ] Add a manual admin override with audit information
- [ ] Test concurrent attempts for the final available spot
- [ ] Prevent capacity from being exceeded under concurrent requests

---

## Phase 8 — Stripe payment integration

### Account and configuration — CLIENT DEPENDENCY

- [ ] Client creates or completes the ARTIS Stripe account
- [ ] Client completes Stripe identity/business verification
- [ ] Client connects the correct business bank account
- [ ] Client enables appropriate receipt/business settings
- [ ] Obtain test-mode keys through a secure method
- [ ] Add test keys to server-side environment configuration

### Checkout implementation

- [ ] Create Stripe products/prices or document the chosen dynamic-pricing approach
- [ ] Create Checkout Sessions on the server
- [ ] Attach internal registration identifiers to Stripe metadata
- [ ] Set success and cancellation return URLs
- [ ] Build payment-success page
- [ ] Build payment-cancelled/unsuccessful page
- [ ] Ensure the success page does not independently mark a registration paid
- [ ] Store currency amounts as integer cents
- [ ] Store the expected amount and currency with the registration/payment record

### Webhooks and payment integrity

- [ ] Create the Stripe webhook endpoint
- [ ] Verify webhook signatures
- [ ] Handle successful checkout/payment events
- [ ] Handle failed, expired, refunded, and disputed payment states as required
- [ ] Make webhook processing idempotent so duplicate events are safe
- [ ] Compare paid amount/currency with the expected registration amount
- [ ] Record Stripe session, payment, and event identifiers
- [ ] Update registration status only from trusted server-side events
- [ ] Release capacity when a checkout expires or payment fails
- [ ] Test successful payment
- [ ] Test declined payment
- [ ] Test cancelled checkout
- [ ] Test delayed payment confirmation
- [ ] Test duplicate webhook delivery
- [ ] Test refreshing the success page
- [ ] Test refund/status reconciliation

---

## Phase 9 — Email and customer communications

- [ ] Configure a transactional email provider
- [ ] Verify the sending domain/address
- [ ] Create registration-received/pending-payment email if needed
- [ ] Create paid-registration confirmation email
- [ ] Include the package, group, schedule, expiry, contact information, and registration reference
- [ ] Ensure Stripe’s receipt behaviour is configured
- [ ] Create waitlist confirmation email
- [ ] Create admin notification for a completed registration
- [ ] Create admin notification for a new waitlist entry
- [ ] Create payment-failure or incomplete-registration guidance if needed
- [ ] Create renewal/expiry reminder templates if included in scope
- [ ] Test delivery to multiple email providers
- [ ] Test plain-text fallback and mobile display
- [ ] Avoid placing sensitive medical details in email

---

## Phase 10 — Capacity, expiry, and waitlist automation

- [ ] Define precisely what counts as an occupied spot
- [ ] Count confirmed, currently active enrolments rather than historical rows
- [ ] Define how temporary payment holds affect displayed availability
- [ ] Automatically calculate availability from capacity minus occupied spots
- [ ] Prevent registration when no spot is available
- [ ] Offer the waitlist when a group is full or registration is closed
- [ ] Store waitlist order and timestamps
- [ ] Allow admins to view and update waitlist status
- [ ] Decide whether waitlist invitations are manual for version one
- [ ] Automatically mark packages expired when their expiry time passes, or calculate expiry dynamically
- [ ] Decide whether a scheduled background job is necessary for reminders/status cleanup
- [ ] Ensure an expired player stops counting toward capacity without deleting history
- [ ] Allow an admin to mark an early departure/cancellation
- [ ] Release capacity when a registration becomes inactive
- [ ] Test capacity after expiry, cancellation, refund, and manual changes

---

## Phase 11 — Admin dashboard

### Authentication and authorization

- [ ] Implement secure admin sign-in
- [ ] Protect every admin page on the server
- [ ] Protect every admin action/API route independently of the page
- [ ] Add sign-out
- [ ] Add password reset or provider recovery flow
- [ ] Limit accounts to authorized ARTIS personnel
- [ ] Define owner/admin roles if more than one permission level is needed
- [ ] Add basic audit information for sensitive changes

### Dashboard and customer management

- [ ] Build dashboard summary
- [ ] Show active-player counts by group
- [ ] Show capacity and remaining spots by group
- [ ] Show pending, paid, active, expired, cancelled, refunded, and waitlisted counts
- [ ] Build searchable/filterable parent and player list
- [ ] Build registration-detail view
- [ ] Keep medical/allergy details out of general list views
- [ ] Show sensitive details only where operationally necessary
- [ ] Allow appropriate customer/contact corrections
- [ ] Allow admins to change operational registration status with confirmation
- [ ] Prevent accidental permanent deletion of customer history
- [ ] Build CSV export with a deliberate selection of columns
- [ ] Test CSV output and protect sensitive fields

### Business controls

- [ ] Allow admins to open/close registration by group
- [ ] Allow admins to manage group capacity
- [ ] Allow admins to manage package availability and prices, if included
- [ ] Allow admins to manage schedule information, if included
- [ ] Allow admins to view and manage waitlist entries
- [ ] Allow admins to record early departure or non-renewal
- [ ] Decide which website copy is editable in version one
- [ ] Add confirmation dialogs for consequential changes
- [ ] Add clear empty, loading, error, and success states

---

## Phase 12 — Testing and quality assurance

### Automated testing

- [ ] Add unit tests for validation and business rules
- [ ] Test age-group eligibility
- [ ] Test price and discount selection
- [ ] Test capacity calculations
- [ ] Test package start and expiry calculations
- [ ] Test status transitions
- [ ] Test webhook signature and idempotency logic
- [ ] Test permission checks
- [ ] Add integration tests for database-backed registration
- [ ] Add end-to-end tests for the critical registration journey if practical
- [ ] Run linting, type checking, tests, and production build together

### Manual functional testing

- [ ] Test a valid ages 8–10 registration
- [ ] Test a valid ages 11–14 registration
- [ ] Test a child outside the permitted age range
- [ ] Test missing and malformed fields
- [ ] Test duplicate form submissions
- [ ] Test a full group
- [ ] Test the final remaining spot with simultaneous attempts
- [ ] Test the waitlist
- [ ] Test successful, failed, cancelled, and delayed payments
- [ ] Test confirmation emails
- [ ] Test admin login and logout
- [ ] Test admin search, filters, edits, status changes, and exports
- [ ] Test package expiry and released capacity
- [ ] Test all policy and contact links
- [ ] Test 404 and server-error behaviour

### Browser, device, accessibility, and performance testing

- [ ] Test current Chrome, Edge, Firefox, and Safari
- [ ] Test common Android and iPhone screen sizes
- [ ] Test narrow mobile screens and landscape orientation
- [ ] Test keyboard-only navigation
- [ ] Test labels, focus order, error announcements, and colour contrast
- [ ] Test with browser zoom and larger text
- [ ] Run accessibility audit and correct important findings
- [ ] Run performance audit
- [ ] Optimize images, fonts, scripts, and database queries
- [ ] Confirm forms remain usable on a slow connection

### Client acceptance

- [ ] Deploy a private staging/review version
- [ ] Give the client a structured acceptance checklist
- [ ] Have the client test the full parent journey
- [ ] Have the client test the admin dashboard
- [ ] Record requested changes and separate bugs from new scope
- [ ] Fix launch-blocking defects
- [ ] Obtain written client approval to launch

---

## Phase 13 — Hosting and production deployment

### Production infrastructure

- [ ] Confirm Hostinger plan supports the selected Next.js runtime and required server features
- [ ] Confirm production domain ownership and DNS access
- [ ] Create production MySQL database and least-privileged database user
- [ ] Configure production environment variables securely
- [ ] Apply production database migrations
- [ ] Seed required training groups and packages without test customers
- [ ] Configure HTTPS/SSL
- [ ] Configure production email service
- [ ] Configure production logging and error alerts
- [ ] Configure database backups and test recovery procedure
- [ ] Configure uptime monitoring if included

### Stripe production activation

- [ ] Obtain production keys securely
- [ ] Configure production webhook endpoint and signing secret
- [ ] Verify production success and cancellation URLs
- [ ] Confirm business name and statement descriptor
- [ ] Perform one low-value real transaction
- [ ] Confirm database registration, Stripe payment, email, and dashboard result
- [ ] Refund the test transaction and confirm refund handling

### Final launch preparation

- [ ] Remove or replace every placeholder
- [ ] Confirm all client-approved prices, schedules, policies, and contact details
- [ ] Remove test accounts and test registrations from production
- [ ] Disable development-only tools and verbose logs
- [ ] Confirm registration-open settings
- [ ] Confirm capacity values
- [ ] Create launch-day backup
- [ ] Prepare rollback/maintenance-page procedure

---

## Phase 14 — SEO, analytics, and business presence

- [ ] Write unique page titles and meta descriptions
- [ ] Add canonical URLs
- [ ] Add structured data appropriate to the local business
- [ ] Add Open Graph/social-sharing metadata and image
- [ ] Create sitemap
- [ ] Create robots file
- [ ] Add descriptive image alt text
- [ ] Confirm headings and page structure are semantic
- [ ] Configure analytics with appropriate privacy considerations
- [ ] Track useful events such as registration start, checkout start, waitlist submission, and confirmed registration
- [ ] Avoid treating a success-page view alone as a confirmed sale
- [ ] Connect Google Search Console
- [ ] Submit sitemap and inspect indexing
- [ ] Create or complete Google Business Profile
- [ ] Add correct address/service area, hours, phone, website, and images
- [ ] Confirm no sensitive registration data is sent to analytics

---

## Phase 15 — Launch

- [ ] Schedule launch window with client
- [ ] Confirm client contact is available during launch
- [ ] Deploy approved production version
- [ ] Run production smoke test
- [ ] Test navigation and public content
- [ ] Submit one controlled production registration/payment if not already completed
- [ ] Confirm email delivery
- [ ] Confirm admin dashboard displays the transaction correctly
- [ ] Confirm analytics and error reporting
- [ ] Open production registration
- [ ] Notify client that launch is complete
- [ ] Provide client with admin access through a secure method
- [ ] Provide client with basic admin instructions
- [ ] Monitor logs, payments, emails, and registrations closely during the first 48–72 hours

---

## Phase 16 — Handoff, maintenance, and post-launch improvement

### Handoff

- [ ] Provide written admin-dashboard instructions
- [ ] Demonstrate viewing customers, changing statuses, managing capacity, and exporting data
- [ ] Explain Stripe dashboard basics and refund responsibility
- [ ] Explain how expired and inactive registrations affect capacity
- [ ] Explain backup and support arrangements
- [ ] Provide a list of accounts/services owned by the client
- [ ] Confirm the client controls the domain, Stripe account, business email, and other core business accounts
- [ ] Document support contact and response expectations

### Maintenance

- [ ] Agree on monthly maintenance scope and price
- [ ] Define what counts as maintenance versus a new feature
- [ ] Schedule dependency and security updates
- [ ] Monitor failed payments, email failures, application errors, and uptime
- [ ] Review backups periodically
- [ ] Review access when staff changes
- [ ] Remove obsolete admin accounts promptly
- [ ] Review privacy/data-retention needs periodically

### Post-launch review

- [ ] Hold a review after the first week
- [ ] Hold a review after the first month
- [ ] Review registration conversion and abandonment
- [ ] Review questions or problems reported by parents
- [ ] Review admin workflow problems
- [ ] Review capacity and waitlist behaviour
- [ ] Prioritize improvements based on evidence rather than guesses
- [ ] Consider automated renewal reminders
- [ ] Consider automated waitlist invitations
- [ ] Consider expanded content editing/CMS capability
- [ ] Consider additional programs, locations, groups, or schedules
- [ ] Consider richer reporting only after the core workflow is stable

---

## Current project position

The project is currently spanning four early phases:

- Phase 1: discovery is substantially underway, but final business rules still require confirmation.
- Phase 2: the logo is available and the content/image request has been sent; client materials are still outstanding.
- Phase 3: the technical stack and local database tooling are established.
- Phase 4: the first database table and migration exist; the complete registration data model is the next major development task.
- Phase 5: initial desktop/mobile and registration/payment design work exists; admin, waitlist, validation, and edge-case states still need design work.

## Immediate next actions

- [ ] Draw and approve the complete database relationship model
- [ ] Define the registration and package status lifecycle
- [ ] Add the `packages` table
- [ ] Add parent/player and registration tables
- [ ] Map every registration-form field to the database
- [ ] Add admin-dashboard and waitlist screens to the design
- [ ] Track the outstanding client decisions and supplied content in one place

