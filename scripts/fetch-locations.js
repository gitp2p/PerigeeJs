#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { isIP } = require('node:net');
const { parseArgs } = require('node:util');
const { setTimeout: sleep } = require('node:timers/promises');

function parseLinks(text) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    const fields = line.trim().split(/\s+/);
    const delay = Number(fields[2]);
    if (fields.length !== 3 || !isIP(fields[0]) || !isIP(fields[1]) || !Number.isFinite(delay) || delay < 0) {
      throw new Error(`Invalid IP/IP/delay record at line ${index + 1}`);
    }
    return [{ from: fields[0], to: fields[1], delay }];
  });
}

async function fetchLocations(links, { endpoint, intervalMs = 2700, fetchImpl = fetch }) {
  if (typeof endpoint !== 'string' || !endpoint.includes('{ip}')) {
    throw new Error('Endpoint must contain an {ip} placeholder');
  }
  const endpointUrl = new URL(endpoint.replace('{ip}', '127.0.0.1'));
  if (!['http:', 'https:'].includes(endpointUrl.protocol)) {
    throw new Error('Endpoint must use HTTP or HTTPS');
  }
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 0) {
    throw new Error('Interval must be a nonnegative integer in milliseconds');
  }
  const cache = new Map();
  let requested = false;
  async function locate(ip) {
    if (cache.has(ip)) return cache.get(ip);
    if (requested && intervalMs > 0) await sleep(intervalMs);
    requested = true;
    const response = await fetchImpl(endpoint.replaceAll('{ip}', encodeURIComponent(ip)), {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Location request for ${ip} failed: HTTP ${response.status}`);
    const location = await response.json();
    const country = location.countryCode || location.country_code;
    if (location.status === 'fail' || location.success === false || typeof country !== 'string' ||
        !/^[a-z]{2}$/i.test(country) || typeof location.city !== 'string' || !location.city.trim()) {
      throw new Error(`Invalid location response for ${ip}`);
    }
    const result = { country: country.toLowerCase(), city: location.city.trim().toLowerCase() };
    cache.set(ip, result);
    return result;
  }
  const grouped = Object.create(null);
  for (const { from, to, delay } of links) {
    const left = await locate(from);
    const right = await locate(to);
    const countryKey = `${left.country}-${right.country}`;
    const cityKey = `${left.city}-${right.city}`;
    grouped[countryKey] ??= Object.create(null);
    grouped[countryKey][cityKey] ??= [];
    grouped[countryKey][cityKey].push(delay);
  }
  return grouped;
}

async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({ args: argv, options: {
    input: { type: 'string' },
    output: { type: 'string' },
    endpoint: { type: 'string' },
    'interval-ms': { type: 'string', default: '2700' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/fetch-locations.js --input LINKS --output JSON --endpoint "https://provider/path/{ip}" [--interval-ms 2700]');
    console.log('Provider responses must include countryCode (or country_code) and city. Requests are sequential and cached by IP.');
    return;
  }
  if (!values.input || !values.output || !values.endpoint) {
    throw new Error('--input, --output, and --endpoint are required; use --help for usage');
  }
  const links = parseLinks(await fs.readFile(values.input, 'utf8'));
  const grouped = await fetchLocations(links, {
    endpoint: values.endpoint,
    intervalMs: Number(values['interval-ms']),
  });
  await fs.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
  await fs.writeFile(values.output, `${JSON.stringify(grouped, null, 2)}\n`);
  console.log(values.output);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseLinks, fetchLocations, main };
