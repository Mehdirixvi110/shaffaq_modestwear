import { chromium } from "playwright-core";
import { resolve } from "node:path";

const baseURL = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) throw new Error("SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD are required.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function addFirstProduct(page) {
  await page.goto(`${baseURL}/products/sample-look-01-espresso`);
  await page.getByRole("button", { name: "52", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.getByText("Added to your shopping bag.").waitFor();
}

async function fillCheckout(page, suffix) {
  await page.goto(`${baseURL}/checkout`);
  await page.getByLabel("Full name").fill(`Smoke Customer ${suffix}`);
  await page.getByLabel("Email", { exact: true }).fill(`smoke-${suffix}@example.test`);
  await page.getByLabel("Pakistan phone").fill("03001234567");
  await page.getByLabel("Address line 1").fill("1 Test Street");
  await page.getByLabel("City").fill("Karachi");
}

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(baseURL);
  assert((await page.title()).includes("SHAFFAQ"), "Homepage metadata is missing SHAFFAQ.");
  assert(await page.locator(".product-card").count() >= 4, "Homepage product grid did not render.");
  await page.getByLabel("Newsletter email").fill("smoke-newsletter@example.test");
  await page.getByRole("checkbox", { name: /explicitly consent/ }).check();
  await page.getByRole("button", { name: "Record consent" }).click();
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
  await page.getByRole("button", { name: "Place cash-on-delivery order" }).click();
  await page.waitForURL(/\/orders\/SHQ-/);
  await page.getByText("pending confirmation", { exact: false }).first().waitFor();
  await context.close();

  const inquiryContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const inquiryPage = await inquiryContext.newPage();
  await addFirstProduct(inquiryPage);
  await fillCheckout(inquiryPage, "whatsapp");
  await inquiryPage.getByRole("button", { name: "Create WhatsApp inquiry" }).click();
  await inquiryPage.getByText("Inquiry recorded").waitFor();
  const whatsappHref = await inquiryPage.getByRole("link", { name: "Open WhatsApp" }).getAttribute("href");
  assert(Boolean(whatsappHref?.startsWith("https://wa.me/923001234567?text=")), "WhatsApp URL did not use the configured business number.");
  assert(decodeURIComponent(whatsappHref ?? "").includes("does not confirm your order or payment"), "WhatsApp disclaimer is missing.");
  await inquiryContext.close();

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${baseURL}/admin`);
  await adminPage.waitForURL(/\/admin\/login/);
  await adminPage.getByLabel("Email").fill(adminEmail);
  await adminPage.getByLabel("Password").fill(adminPassword);
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await adminPage.waitForURL(`${baseURL}/admin`);
  await adminPage.getByRole("heading", { name: "Dashboard" }).waitFor();
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
  for (const [path, heading] of [["orders", "Orders"], ["returns", "Returns & exchanges"], ["customers", "Customers"], ["reviews", "Reviews"], ["newsletter", "Newsletter"], ["settings", "Settings"]]) {
    await adminPage.goto(`${baseURL}/admin/${path}`);
    await adminPage.getByRole("heading", { name: heading }).waitFor();
  }
  await adminContext.close();

  const couponContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const couponPage = await couponContext.newPage();
  await addFirstProduct(couponPage);
  await couponPage.goto(`${baseURL}/cart`);
  await couponPage.getByLabel("Coupon code").fill("smoke10");
  await couponPage.getByRole("button", { name: "Apply" }).click();
  await couponPage.getByText("Coupon SMOKE10 applied.").waitFor();
  await fillCheckout(couponPage, "coupon");
  await couponPage.getByRole("button", { name: "Place cash-on-delivery order" }).click();
  await couponPage.waitForURL(/\/orders\/SHQ-/);
  await couponContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(baseURL);
  const columns = await mobilePage.locator(".product-grid").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  assert(columns === 2, `Expected two mobile product columns, received ${columns}.`);
  await mobilePage.getByRole("button", { name: "Open navigation" }).click();
  await mobilePage.getByRole("dialog", { name: "Site navigation" }).waitFor();
  await mobilePage.getByRole("button", { name: "Close navigation" }).click();
  await mobileContext.close();

  console.log("Browser smoke passed: desktop storefront, wishlist, newsletter consent/unsubscribe, COD and coupon checkout, WhatsApp inquiry, operational admin routes, inventory adjustment, and Sharp media re-encoding, plus 390px navigation/grid.");
} finally {
  await browser.close();
}
