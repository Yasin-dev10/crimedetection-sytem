/**
 * Offline smoke test for the website monitor URL validator / SSRF guards.
 * Run: node scripts/testWebsiteUrlValidator.js
 */
const {
  validateWebsiteUrlValue,
  assertSafeUrl,
  isBlockedAddress,
  normalizePageUrl,
} = require("../services/websiteMonitor");

let failures = 0;

const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} (got ${actual}, expected ${expected})`);
};

// --- syntactic validation ---
check("accepts https URL", validateWebsiteUrlValue("https://example.com").ok, true);
check("accepts http URL with path", validateWebsiteUrlValue("http://example.com/news").ok, true);
check("rejects empty", validateWebsiteUrlValue("").ok, false);
check("rejects relative", validateWebsiteUrlValue("example.com").ok, false);
check("rejects ftp scheme", validateWebsiteUrlValue("ftp://example.com").ok, false);
check("rejects file scheme", validateWebsiteUrlValue("file:///etc/passwd").ok, false);
check("rejects data scheme", validateWebsiteUrlValue("data:text/html,hi").ok, false);
check("rejects credentials", validateWebsiteUrlValue("https://user:pass@example.com").ok, false);
check("rejects localhost", validateWebsiteUrlValue("http://localhost:3000").ok, false);
check("rejects .localhost", validateWebsiteUrlValue("http://api.localhost").ok, false);
check("rejects raw loopback IP", validateWebsiteUrlValue("http://127.0.0.1").ok, false);
check("rejects raw private IP", validateWebsiteUrlValue("http://192.168.1.10").ok, false);
check("rejects metadata IP", validateWebsiteUrlValue("http://169.254.169.254/latest").ok, false);
check("rejects IPv6 loopback", validateWebsiteUrlValue("http://[::1]").ok, false);
check("accepts public IP", validateWebsiteUrlValue("http://93.184.216.34").ok, true);

// --- address blocking ---
check("blocks 10.0.0.1", isBlockedAddress("10.0.0.1"), true);
check("blocks 172.16.0.1", isBlockedAddress("172.16.0.1"), true);
check("blocks 172.31.255.255", isBlockedAddress("172.31.255.255"), true);
check("allows 172.32.0.1", isBlockedAddress("172.32.0.1"), false);
check("blocks 169.254.169.254", isBlockedAddress("169.254.169.254"), true);
check("blocks 100.64.0.1 (CGNAT)", isBlockedAddress("100.64.0.1"), true);
check("blocks 0.0.0.0", isBlockedAddress("0.0.0.0"), true);
check("blocks 224.0.0.1 (multicast)", isBlockedAddress("224.0.0.1"), true);
check("blocks 255.255.255.255", isBlockedAddress("255.255.255.255"), true);
check("allows 8.8.8.8", isBlockedAddress("8.8.8.8"), false);
check("blocks ::1", isBlockedAddress("::1"), true);
check("blocks fe80::1", isBlockedAddress("fe80::1"), true);
check("blocks fd00::1", isBlockedAddress("fd00::1"), true);
check("blocks ff02::1", isBlockedAddress("ff02::1"), true);
check("blocks mapped ::ffff:127.0.0.1", isBlockedAddress("::ffff:127.0.0.1"), true);
check("blocks mapped ::ffff:10.0.0.1", isBlockedAddress("::ffff:10.0.0.1"), true);
check("allows 2606:2800:220:1::1", isBlockedAddress("2606:2800:220:1::1"), false);
check("blocks garbage", isBlockedAddress("not-an-ip"), true);

// --- URL normalization ---
check(
  "normalizes trailing slash",
  normalizePageUrl("https://Example.com/news/"),
  "https://example.com/news"
);
check(
  "strips hash",
  normalizePageUrl("https://example.com/a#section"),
  "https://example.com/a"
);

// --- async guard (IP literals only, no network needed) ---
(async () => {
  const expectReject = async (label, url) => {
    try {
      await assertSafeUrl(url);
      failures += 1;
      console.log(`FAIL  ${label} (was not rejected)`);
    } catch {
      console.log(`PASS  ${label}`);
    }
  };

  await expectReject("assertSafeUrl rejects 127.0.0.1", "http://127.0.0.1/admin");
  await expectReject("assertSafeUrl rejects metadata IP", "http://169.254.169.254/latest/meta-data");
  await expectReject("assertSafeUrl rejects [::1]", "http://[::1]:8080/");

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("All website URL validator checks passed");
  process.exit(0);
})();
