const prod = process.env.NODE_ENV === 'production';
const frontUrl = prod ? "https://ymillonga.kr" : "http://localhost:3050";
module.exports = frontUrl;