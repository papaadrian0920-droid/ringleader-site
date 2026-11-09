// Paying on the website: the sign-up form sends the shop to a Stripe Payment Link, the page Stripe hosts for us,
// in the same tab. After paying, Stripe brings them straight back to welcome.html to finish setting up.
// See plans/payments-on-the-website.md for the Stripe settings each link needs.
window.RingleaderPay = {
  // PASTE the LIVE Stripe Payment Links here (they start with https://buy.stripe.com/ and have no "test_").
  // Empty `link` = the form stays a setup request with nothing to pay, like before.
  link: 'https://buy.stripe.com/bJe3cu8moghI2MJ2qV9EI00',
  // Yearly: C$950 once a year, paid up front, not refundable. Empty = the Yearly button says "later".
  yearlyLink: '',
  // The sandbox links. Only used when the page address ends in ?testpay, so real visitors never see them.
  testLink: 'https://buy.stripe.com/test_bJeaEX2tq3ZX3yP9Qn7AI01',
  testYearlyLink: '',
  // The founding-shop promotion code in Stripe ($30 off for 3 months). Filled in for monthly shops while the deal is on.
  foundingCode: 'FOUNDING',
  // Our server. The sign-up form is saved here just before Stripe, and the after-payment steps (welcome.html) talk to it.
  api: 'https://api.getringleader.ca',
  signupApi: 'https://api.getringleader.ca/api/signup',
  // Where shops manage their card or cancel (Stripe's customer portal).
  portal: 'https://billing.stripe.com/p/login/bJe3cu8moghI2MJ2qV9EI00',
};
