import { chromium } from "playwright-core";
import { resolve } from "node:path";

const baseURL = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
const whatsappNumber = process.env.SMOKE_WHATSAPP_NUMBER ?? "923001234567";
if (!adminEmail || !adminPassword) throw new Error("SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD are required.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function progress(stage) {
  console.log(`[browser-smoke] ${stage}`);
}

async function addFirstProduct(page) {
  await page.goto(`${baseURL}/products/sample-look-01-espresso`);
  await page.getByRole("button", { name: "52", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.getByText("Added to your shopping bag.").waitFor();
}

async function fillCheckout(page, suffix, { email } = {}) {
  await page.goto(`${baseURL}/checkout`);
  await page.getByLabel("Full name").fill(`Smoke Customer ${suffix}`);
  // Email is optional now. Pass email: "" to exercise the no-email path; otherwise
  // use a gmail address so the consumer-provider allowlist happy-path is covered.
  if (email !== "") await page.getByLabel("Email (optional)").fill(email ?? `smoke-${suffix}@gmail.com`);
  await page.getByLabel("Pakistan phone").fill("03001234567");
  await page.getByLabel("Address line 1").fill("1 Test Street");
  // City is a province-grouped dropdown; selecting it auto-fills the Province field.
  await page.getByLabel("City").selectOption("Karachi");
}

// --- Hardening checks: favicon, strict CSP, and the WhatsApp chat button ---
const cspViolations = [];
const iconErrors = [];
const pageErrors = [];

// Attach to every page so a CSP violation or missing favicon anywhere fails the run.
// Benign RSC prefetch aborts (net::ERR_ABORTED) are ignored.
function watchPage(page, label) {
  page.on("console", (message) => {
    const text = message.text();
    if (/Content Security Policy|Refused to (execute|evaluate|load|apply|connect|frame|create)/i.test(text) && !/ERR_ABORTED/i.test(text)) {
      cspViolations.push(`[${label}] ${text}`);
    }
  });
  page.on("pageerror", (error) => { pageErrors.push(`[${label}] ${error.message}`); });
  page.on("response", (response) => {
    if (response.status() === 404 && /\/(icon\.png|favicon\.ico|apple-icon)(\?|$)/i.test(response.url())) {
      iconErrors.push(`[${label}] 404 ${response.url()}`);
    }
  });
}

async function assertFaviconLoads(page, label) {
  const iconHref = await page.locator('link[rel~="icon"]').first().getAttribute("href");
  assert(Boolean(iconHref), `${label}: no <link rel="icon"> injected by Next metadata.`);
  const iconResponse = await page.request.get(new URL(iconHref, baseURL).toString());
  assert(iconResponse.status() === 200, `${label}: favicon did not return 200 (got ${iconResponse.status()}).`);
  assert((iconResponse.headers()["content-type"] ?? "").includes("image/png"), `${label}: favicon is not image/png.`);
}

async function assertChatButton(page, label) {
  const chat = page.locator("a.whatsapp-chat");
  await chat.waitFor({ state: "visible" });
  const href = await chat.getAttribute("href");
  assert(Boolean(href?.startsWith(`https://wa.me/${whatsappNumber}?text=`)), `${label}: chat button href is wrong (${href}).`);
  assert((await chat.getAttribute("aria-label")) === "Chat with us on WhatsApp", `${label}: chat button aria-label is wrong.`);
  assert((await chat.getAttribute("target")) === "_blank", `${label}: chat button does not open a new tab (target).`);
  const rel = (await chat.getAttribute("rel")) ?? "";
  assert(rel.includes("noopener") && rel.includes("noreferrer"), `${label}: chat button rel is missing noopener/noreferrer.`);
  await chat.focus();
  assert(await chat.evaluate((element) => element === document.activeElement), `${label}: chat button is not keyboard-focusable.`);
}

// Inject a transient toast with the real .purchase-note CSS and assert its box never
// intersects the chat button box — without waiting for the 4-5 minute toast timer.
async function assertNoToastOverlap(page, label) {
  const rects = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "purchase-note";
    probe.innerHTML = '<div class="purchase-note__body"><p class="purchase-note__text"><strong>Probe</strong> from Lahore purchased <strong>Sample piece</strong></p><button class="purchase-note__close" aria-label="Dismiss notification">\u00d7</button></div>';
    document.body.appendChild(probe);
    const chat = document.querySelector("a.whatsapp-chat");
    const box = (element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    const result = { toast: box(probe), chat: chat ? box(chat) : null };
    probe.remove();
    return result;
  });
  assert(rects.chat, `${label}: chat button missing for the overlap probe.`);
  const overlap = !(rects.chat.right <= rects.toast.left || rects.chat.left >= rects.toast.right || rects.chat.bottom <= rects.toast.top || rects.chat.top >= rects.toast.bottom);
  assert(!overlap, `${label}: chat button overlaps the sale toast (chat ${JSON.stringify(rects.chat)}, toast ${JSON.stringify(rects.toast)}).`);
}

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  progress("storefront, newsletter, wishlist, and COD checkout");
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultNavigationTimeout(90_000);
  const page = await context.newPage();
  watchPage(page, "desktop-storefront");
  await page.goto(baseURL);
  assert((await page.title()).includes("SHAFFAQ"), "Homepage metadata is missing SHAFFAQ.");
  assert(await page.locator(".product-card").count() >= 4, "Homepage product grid did not render.");
  await assertFaviconLoads(page, "desktop-storefront");
  await assertChatButton(page, "desktop-storefront");
  await assertNoToastOverlap(page, "desktop-storefront");
  // FEAT E: the delivery marquee renders delivery copy and scrolls.
  const marquee = page.locator(".delivery-marquee");
  await marquee.waitFor({ state: "visible" });
  assert((await marquee.innerText()).toLowerCase().includes("delivery"), "Delivery marquee did not render delivery copy.");
  const marqueeAnim = await page.locator(".delivery-marquee__row").evaluate((element) => getComputedStyle(element).animationName);
  assert(marqueeAnim === "delivery-marquee-scroll", `Delivery marquee is not scrolling (animationName=${marqueeAnim}).`);
  await page.getByLabel("Email address").fill("smoke-newsletter@example.test");
  await page.getByRole("checkbox", { name: /email me SHAFFAQ/ }).check();
  await page.getByRole("button", { name: "Subscribe" }).click();
  const newsletterMessage = await page.locator(".newsletter-form p").first().innerText();
  assert(newsletterMessage.includes("Consent recorded"), `Newsletter consent failed: ${newsletterMessage}`);
  const unsubscribeHref = await page.getByRole("link", { name: "Save your unsubscribe link" }).getAttribute("href");
  assert(Boolean(unsubscribeHref?.startsWith("/newsletter/unsubscribe/")), "Newsletter unsubscribe capability was not returned.");
  await page.goto(`${baseURL}${unsubscribeHref}`);
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await page.getByText("Newsletter consent has been withdrawn. No email was sent.").waitFor();
  await page.goto(`${baseURL}/collections/new-edit`);
  assert(await page.locator(".product-card").count() >= 1, "Collection did not render persisted products.");
  await page.goto(`${baseURL}/products/sample-look-01-espresso`);
  await page.getByRole("button", { name: "Save to wishlist" }).click();
  await page.getByText("Saved to this browser's wishlist.").waitFor();
  await page.goto(`${baseURL}/wishlist`);
  assert(await page.locator(".product-card").count() === 1, "Anonymous database-backed wishlist did not persist.");
  await addFirstProduct(page);
  await page.goto(`${baseURL}/cart`);
  assert(await page.locator(".cart-line").count() === 1, "Server-backed cart did not persist.");
  await fillCheckout(page, "cod");
  // FEAT A: Province auto-fills from the selected city (Karachi -> Sindh).
  assert((await page.getByLabel("Province").inputValue()) === "Sindh", "Province did not auto-fill from the selected city.");
  // FEAT A: the "we'll do it for you" WhatsApp fallback links to the business number.
  const fallbackHref = await page.locator(".checkout-whatsapp-fallback a").getAttribute("href");
  assert(Boolean(fallbackHref?.startsWith(`https://wa.me/${whatsappNumber}?text=`)), `Checkout WhatsApp fallback href is wrong (${fallbackHref}).`);
  // FEAT A: "Other / not listed" reveals a manual province selector so an unlisted town is never blocked.
  await page.getByLabel("City").selectOption("__other__");
  await page.getByLabel("Area / town").fill("Example Village");
  await page.getByLabel("Province").selectOption("Punjab");
  await page.getByLabel("City").selectOption("Karachi");
  assert((await page.getByLabel("Province").inputValue()) === "Sindh", "Province did not re-derive after returning to a listed city.");
  // FEAT A: an invalid phone is rejected client-side and does not navigate away.
  await page.getByLabel("Pakistan phone").fill("0300");
  await page.getByRole("button", { name: "Place cash-on-delivery order" }).click();
  await page.getByText("starting with 03", { exact: false }).first().waitFor({ timeout: 5000 });
  assert(page.url().includes("/checkout"), "Invalid phone should not navigate away from checkout.");
  await page.getByLabel("Pakistan phone").fill("03001234567");
  await page.getByRole("button", { name: "Place cash-on-delivery order" }).click();
  await page.waitForURL(/\/orders\/SHQ-/);
  await page.getByText("pending confirmation", { exact: false }).first().waitFor();
  await context.close();

  progress("WhatsApp inquiry checkout");
  const inquiryContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  inquiryContext.setDefaultNavigationTimeout(90_000);
  const inquiryPage = await inquiryContext.newPage();
  watchPage(inquiryPage, "desktop-inquiry");
  await addFirstProduct(inquiryPage);
  // Email left blank here to verify an order persists without one (FEAT A optional email).
  await fillCheckout(inquiryPage, "whatsapp", { email: "" });
  await inquiryPage.getByRole("button", { name: "Create WhatsApp inquiry" }).click();
  await inquiryPage.getByText("Inquiry recorded").waitFor();
  const whatsappHref = await inquiryPage.getByRole("link", { name: "Open WhatsApp" }).getAttribute("href");
  assert(Boolean(whatsappHref?.startsWith(`https://wa.me/${whatsappNumber}?text=`)), "WhatsApp URL did not use the configured business number.");
  assert(decodeURIComponent(whatsappHref ?? "").includes("does not confirm your order or payment"), "WhatsApp disclaimer is missing.");
  await inquiryContext.close();

  progress("protected administration and media");
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  adminContext.setDefaultNavigationTimeout(90_000);
  const adminPage = await adminContext.newPage();
  watchPage(adminPage, "admin");
  await adminPage.goto(`${baseURL}/admin`);
  await adminPage.waitForURL(/\/admin\/login/);
  await adminPage.getByLabel("Email").fill(adminEmail);
  // Password field has a reveal toggle sharing the label, so target the input by name.
  await adminPage.locator('input[name="password"]').fill(adminPassword);
  await adminPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await adminPage.waitForURL(`${baseURL}/admin`);
  await adminPage.getByRole("heading", { name: "Dashboard" }).waitFor();
  assert((await adminPage.locator("a.whatsapp-chat").count()) === 0, "Chat button must be absent on /admin.");
  await adminPage.goto(`${baseURL}/admin/products`);
  await adminPage.getByRole("heading", { name: "Products" }).waitFor();
  await adminPage.goto(`${baseURL}/admin/categories`);
  await adminPage.getByRole("heading", { name: "Categories" }).waitFor();
  await adminPage.goto(`${baseURL}/admin/collections`);
  await adminPage.getByRole("heading", { name: "Collections" }).waitFor();
  await adminPage.goto(`${baseURL}/admin/inventory`);
  await adminPage.getByRole("heading", { name: "Inventory" }).waitFor();
  const firstInventory = adminPage.locator(".inventory-card").first();
  await firstInventory.getByLabel("Adjustment (+ or −)").fill("1");
  await firstInventory.getByLabel("Reason (required)").fill("Disposable browser smoke adjustment");
  await firstInventory.getByRole("button", { name: "Adjust" }).click();
  await adminPage.getByText("Disposable browser smoke adjustment").waitFor();
  if (process.env.SMOKE_HOSTED === "1") {
    const reversedInventory = adminPage.locator(".inventory-card").first();
    await reversedInventory.getByLabel("Adjustment (+ or −)").fill("-1");
    await reversedInventory.getByLabel("Reason (required)").fill("Disposable browser smoke reversal");
    await reversedInventory.getByRole("button", { name: "Adjust" }).click();
    await adminPage.getByText("Disposable browser smoke reversal").waitFor();
  }
  await adminPage.goto(`${baseURL}/admin/coupons`);
  await adminPage.getByRole("heading", { name: "Coupons" }).waitFor();
  await adminPage.locator("details.create-panel > summary").click();
  await adminPage.getByLabel("Code").fill("SMOKE10");
  await adminPage.getByLabel("Value (percent or PKR; 0 for free shipping)").fill("10");
  await adminPage.getByRole("button", { name: "Create coupon" }).click();
  await adminPage.getByText("SMOKE10", { exact: true }).first().waitFor();
  await adminPage.goto(`${baseURL}/admin/media`);
  await adminPage.getByLabel("Display name").fill("Disposable re-encoded logo test");
  await adminPage.getByLabel("JPEG, PNG, or WebP (max 10 MiB / 40 MP)").setInputFiles(resolve(process.cwd(), "Logo.jpg"));
  await adminPage.getByRole("button", { name: "Upload image" }).click();
  await adminPage.getByText("Image fully decoded, metadata-stripped, re-encoded, and stored under an immutable random name.").waitFor();
  const uploadedImage = adminPage.locator(".media-preview img").first();
  await uploadedImage.waitFor();
  await uploadedImage.evaluate((image) => image instanceof HTMLImageElement ? image.decode() : Promise.reject(new Error("Uploaded media element is not an image.")));
  assert(await uploadedImage.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0), "Uploaded media was not publicly retrievable in the browser.");
  if (process.env.SMOKE_HOSTED === "1") {
    await adminPage.goto(`${baseURL}/admin/homepage`);
    const heroHeading = adminPage.getByLabel("Hero heading");
    const originalHeroHeading = await heroHeading.inputValue();
    await heroHeading.fill(`${originalHeroHeading} verification`);
    const [homepageSaveResponse] = await Promise.all([
      adminPage.waitForResponse((response) => response.url().endsWith("/api/admin/homepage") && response.request().method() === "PATCH"),
      adminPage.getByRole("button", { name: "Save homepage" }).click(),
    ]);
    assert(homepageSaveResponse.ok(), `Homepage edit failed: ${await homepageSaveResponse.text()}`);
    await adminPage.getByText("Homepage saved.", { exact: false }).waitFor();
    await heroHeading.fill(originalHeroHeading);
    await Promise.all([
      adminPage.waitForResponse((response) => response.url().endsWith("/api/admin/homepage") && response.request().method() === "PATCH"),
      adminPage.getByRole("button", { name: "Save homepage" }).click(),
    ]);

    await adminPage.goto(`${baseURL}/admin/settings`);
    const descriptor = adminPage.getByLabel("Descriptor");
    const originalDescriptor = await descriptor.inputValue();
    await descriptor.fill(`${originalDescriptor} verification`);
    await Promise.all([
      adminPage.waitForResponse((response) => response.url().endsWith("/api/admin/settings") && response.request().method() === "PATCH"),
      adminPage.getByRole("button", { name: "Save settings" }).click(),
    ]);
    await adminPage.waitForLoadState("domcontentloaded");
    await adminPage.getByLabel("Descriptor").fill(originalDescriptor);
    await Promise.all([
      adminPage.waitForResponse((response) => response.url().endsWith("/api/admin/settings") && response.request().method() === "PATCH"),
      adminPage.getByRole("button", { name: "Save settings" }).click(),
    ]);
    await adminPage.waitForLoadState("domcontentloaded");
  }
  for (const [path, heading] of [["orders", "Orders"], ["returns", "Returns & exchanges"], ["customers", "Customers"], ["reviews", "Reviews"], ["newsletter", "Newsletter"], ["settings", "Settings"]]) {
    await adminPage.goto(`${baseURL}/admin/${path}`);
    await adminPage.getByRole("heading", { name: heading }).waitFor();
  }
  await adminContext.close();

  progress("coupon checkout");
  const couponContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  couponContext.setDefaultNavigationTimeout(90_000);
  const couponPage = await couponContext.newPage();
  watchPage(couponPage, "desktop-coupon");
  await addFirstProduct(couponPage);
  await couponPage.goto(`${baseURL}/cart`);
  await couponPage.getByLabel("Coupon code").fill("smoke10");
  await couponPage.getByRole("button", { name: "Apply" }).click();
  await couponPage.getByText("Coupon SMOKE10 applied.").waitFor();
  await fillCheckout(couponPage, "coupon");
  await couponPage.getByRole("button", { name: "Place cash-on-delivery order" }).click();
  await couponPage.waitForURL(/\/orders\/SHQ-/);
  await couponContext.close();

  progress("content pages");
  const pagesContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  pagesContext.setDefaultNavigationTimeout(90_000);
  const pagesPage = await pagesContext.newPage();
  watchPage(pagesPage, "content-pages");
  for (const [slug, needle] of [["about", "shaffaq"], ["size-guide", "measure"], ["care", "wash"], ["shipping", "delivery"], ["returns", "exchange"]]) {
    await pagesPage.goto(`${baseURL}/pages/${slug}`);
    const copy = (await pagesPage.locator(".policy-copy").innerText()).toLowerCase();
    assert(copy.includes(needle), `Content page /pages/${slug} is missing expected copy (${needle}).`);
    assert(!copy.includes("template requiring"), `Content page /pages/${slug} still shows the seed placeholder.`);
  }
  await pagesContext.close();

  progress("390px responsive navigation and grid");
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  mobileContext.setDefaultNavigationTimeout(90_000);
  const mobilePage = await mobileContext.newPage();
  watchPage(mobilePage, "mobile");
  await mobilePage.goto(baseURL);
  const columns = await mobilePage.locator(".product-grid").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  assert(columns === 2, `Expected two mobile product columns, received ${columns}.`);
  await assertFaviconLoads(mobilePage, "mobile");
  await assertChatButton(mobilePage, "mobile");
  await assertNoToastOverlap(mobilePage, "mobile");
  await mobilePage.getByRole("button", { name: "Open navigation" }).click();
  await mobilePage.getByRole("dialog", { name: "Site navigation" }).waitFor();
  await mobilePage.getByRole("button", { name: "Close navigation" }).click();
  await mobileContext.close();

  progress("prefers-reduced-motion disables the chat button animation");
  const motionContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  motionContext.setDefaultNavigationTimeout(90_000);
  const motionPage = await motionContext.newPage();
  watchPage(motionPage, "reduced-motion");
  await motionPage.goto(baseURL);
  const motionChat = motionPage.locator("a.whatsapp-chat");
  await motionChat.waitFor({ state: "visible" });
  const animation = await motionChat.evaluate((element) => ({ base: getComputedStyle(element).animationName, ring: getComputedStyle(element, "::after").animationName }));
  assert(animation.base === "none" && animation.ring === "none", `Chat button animation is not disabled under prefers-reduced-motion: ${JSON.stringify(animation)}.`);
  // FEAT E: the delivery marquee is static under prefers-reduced-motion.
  const marqueeMotion = await motionPage.locator(".delivery-marquee__row").evaluate((element) => getComputedStyle(element).animationName);
  assert(marqueeMotion === "none", `Delivery marquee should not animate under prefers-reduced-motion: ${marqueeMotion}.`);
  await motionContext.close();

  assert(cspViolations.length === 0, `CSP violations detected:\n${cspViolations.join("\n")}`);
  assert(iconErrors.length === 0, `Favicon/icon 404 detected:\n${iconErrors.join("\n")}`);
  if (pageErrors.length) console.warn(`[browser-smoke] non-fatal page errors:\n${pageErrors.join("\n")}`);

  console.log("Browser smoke passed: desktop storefront, wishlist, newsletter consent/unsubscribe, COD and coupon checkout, WhatsApp inquiry, operational admin routes, inventory adjustment, and Sharp media re-encoding, plus 390px navigation/grid, favicon, strict-CSP (zero violations), and the storefront-only WhatsApp chat button (desktop + mobile, no toast overlap).");
} finally {
  await browser.close();
}
