/**
 * api/index.js — Vercel Serverless entry point.
 *
 * A Vercel chama este arquivo como handler HTTP.
 * Em desenvolvimento local, use: npx vercel dev
 */
require('dotenv').config();
const app = require('../server');

module.exports = app;
