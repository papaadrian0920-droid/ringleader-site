// Paying on the website: the sign-up form sends the shop to a Stripe Payment Link, the page Stripe hosts for us.
// No server needed. See plans/payments-on-the-website.md for the Stripe settings each link needs.
window.RingleaderPay = {
  // PASTE the LIVE Stripe Payment Link here (it starts with https://buy.stripe.com/ and has no "test_").
  // Empty = the form stays a setup request with nothing to pay, like before.
  link: 'https://buy.stripe.com/bJe3cu8moghI2MJ2qV9EI00',
  // The sandbox link. Only used when the page address ends in ?testpay, so real visitors never see it.
  testLink: 'https://buy.stripe.com/test_bJeaEX2tq3ZX3yP9Qn7AI01',
  // The founding-shop promotion code in Stripe ($30 off for 3 months). Filled in for shops while the deal is on.
  foundingCode: 'FOUNDING',
  // Our server. Just before Stripe, the sign-up form is saved here, so the new shop gets the business name and email
  // the shop typed (not the name on the card). If the server can't be reached, they still go to Stripe.
  signupApi: 'https://api.getringleader.ca/api/signup',
  // Where shops manage their card or cancel (Stripe's customer portal). Shown after they pay.
  portal: 'https://billing.stripe.com/p/login/bJe3cu8moghI2MJ2qV9EI00',
};
