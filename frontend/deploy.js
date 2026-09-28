// Uploads dist/ to the S3 bucket of a target, removes files that are no longer part of the
// build, then invalidates the target's CloudFront distribution.
// Usage: node deploy.js <beta|prd> [--dry-run]
// Settings come from the environment or frontend/.env: S3_BUCKET_BETA, S3_BUCKET_PRD (or S3_BUCKET),
// CLOUDFRONT_DISTRIBUTION_ID_BETA, CLOUDFRONT_DISTRIBUTION_ID_PRD, AWS_REGION (default eu-west-3)
// and the standard AWS credentials.
const fs = require('node:fs');
const path = require('node:path');
const mime = require('mime-types');
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} = require('@aws-sdk/client-s3');
const {CloudFrontClient, CreateInvalidationCommand} = require('@aws-sdk/client-cloudfront');

try {
  process.loadEnvFile(path.resolve(__dirname, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const BUCKET_VARIABLES = {beta: 'S3_BUCKET_BETA', prd: 'S3_BUCKET_PRD'};
const DISTRIBUTION_VARIABLES = {
  beta: 'CLOUDFRONT_DISTRIBUTION_ID_BETA',
  prd: 'CLOUDFRONT_DISTRIBUTION_ID_PRD'
};
const DIST = path.resolve(__dirname, 'dist');
// The service worker and its manifest must never be served stale.
const NO_CACHE = new Set(['index.html', 'ngsw.json']);

function resolveBucket(target) {
  const variable = BUCKET_VARIABLES[target];
  if (!variable) {
    throw new Error(`usage: node deploy.js <${Object.keys(BUCKET_VARIABLES).join('|')}> [--dry-run]`);
  }
  const bucket = process.env[variable] || process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error(`you must provide env. variable ${variable} (or S3_BUCKET)`);
  }
  return bucket;
}

function resolveDistribution(target) {
  const variable = DISTRIBUTION_VARIABLES[target];
  return process.env[variable] || null;
}

function listBuild() {
  if (!fs.existsSync(DIST)) {
    throw new Error('dist/ does not exist, build first');
  }
  return fs.readdirSync(DIST, {recursive: true, withFileTypes: true})
    .filter(entry => entry.isFile())
    .map(entry => path.relative(DIST, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
}

async function listKeys(s3, bucket) {
  const keys = [];
  let ContinuationToken;
  do {
    const page = await s3.send(new ListObjectsV2Command({Bucket: bucket, ContinuationToken}));
    keys.push(...(page.Contents ?? []).map(item => item.Key));
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);
  return keys;
}

async function deploy(target, dryRun) {
  const bucket = resolveBucket(target);
  const s3 = new S3Client({region: process.env.AWS_REGION || 'eu-west-3'});
  const files = listBuild();
  const prefix = dryRun ? '[dry run] ' : '';

  for (const key of files) {
    console.log(`${prefix}uploading: [${key}]`);
    if (dryRun) continue;
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.readFileSync(path.join(DIST, key)),
      ContentType: mime.lookup(key) || 'application/octet-stream',
      ...(NO_CACHE.has(key) && {CacheControl: 'no-cache'})
    }));
  }

  // Removed last, so the site is never empty in the middle of a deploy.
  const uploaded = new Set(files);
  const stale = (await listKeys(s3, bucket)).filter(key => !uploaded.has(key));
  for (let i = 0; i < stale.length; i += 1000) {
    const batch = stale.slice(i, i + 1000).map(Key => ({Key}));
    console.log(`${prefix}deleting ${batch.length} stale file(s)`);
    if (!dryRun) {
      await s3.send(new DeleteObjectsCommand({Bucket: bucket, Delete: {Objects: batch}}));
    }
  }
  if (!stale.length) console.log('Nothing to delete');

  const distributionId = resolveDistribution(target);
  if (!distributionId) {
    console.log('No CloudFront distribution id configured, skipping invalidation');
    return;
  }
  console.log(`${prefix}invalidating CloudFront distribution [${distributionId}]`);
  if (dryRun) return;
  const cloudfront = new CloudFrontClient({region: process.env.AWS_REGION || 'eu-west-3'});
  const {Invalidation} = await cloudfront.send(new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      Paths: {Quantity: 1, Items: ['/*']},
      CallerReference: `deploy-${Date.now()}`
    }
  }));
  console.log(`invalidation created: ${Invalidation.Id} (${Invalidation.Status})`);
}

const [target] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

deploy(target, process.argv.includes('--dry-run'))
  .then(() => console.log('task complete'))
  .catch(err => {
    console.error(err.message);
    process.exit(1);
  });
