const { isDemo, DEMO_RATES } = require('../config');

async function getRate(fromCurrency, toCurrency) {
  const key = `${fromCurrency}-${toCurrency}`;

  if (isDemo) {
    const rate = DEMO_RATES[key];
    if (!rate) throw new Error(`No demo rate for ${key}`);
    return rate;
  }

  throw new Error('Production rate provider not configured');
}

module.exports = { getRate };
