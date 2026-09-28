const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const readdir = require('recursive-readdir');
const mime = require('mime-types');

const BUCKET = process.env.S3_BUCKET;
const rootFolder = path.resolve(__dirname, './');
const uploadFolder = './dist';
const s3 = new AWS.S3({
  signatureVersion: 'v4',
  region: "eu-west-3"
});

function getFiles(dirPath) {
  return fs.existsSync(dirPath) ? readdir(dirPath) : [];
}

if (!BUCKET) {
  throw new Error('you must provide env. variables: [S3_BUCKET]');
}

async function getBucketItems() {
  return new Promise((resolve, reject) => {
    s3.listObjectsV2({Bucket: BUCKET}, (err, data) => {
      if (err) {
        return reject(new Error(err));
      }
      resolve(data);
    })
  })
}

async function clearBucketItems(items) {
  let map = items.map(item => ({Key: item.Key}));
  await s3.deleteObjects({Bucket: BUCKET, Delete: {Objects: map}}, err => {
    if (err) {
      console.error(err, err.message);
      process.exit(1);
    } else {
      console.log("Bucket cleared");
    }
  }).promise();
}

async function deploy(upload) {
  let bucketItems = await getBucketItems();

  if (bucketItems.Contents.length !== 0) {
    await clearBucketItems(bucketItems.Contents);
  } else {
    console.log("Nothing to delete");
  }

  const filesToUpload = await getFiles(path.resolve(__dirname, upload));

  for (let file of filesToUpload) {
    const Key = file.replace(`${rootFolder}/dist/`, '');
    console.log(`uploading: [${Key}]`);
    await s3.putObject({
      Key,
      Bucket: BUCKET,
      Body: fs.readFileSync(file),
      ContentType: mime.lookup(file)
    }, (err) => {
      if (err) {
        console.error(err, err.stack);
        process.exit(1);
      } else console.log(Key + " succesfully uploaded");
    }).promise();
  }
}

deploy(uploadFolder)
  .then(() => {
    console.log('task complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
