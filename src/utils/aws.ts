import AWS from 'aws-sdk'

AWS.config.update({ region: 'eu-west-1' })

export const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_KEY_SECRET,
})

export const sns = new AWS.SNS({
  ...(process.env.IS_OFFLINE && {
    endpoint: 'http://127.0.0.1:4002/email-prod-email',
  }),
})

export const ddb = new AWS.DynamoDB.DocumentClient(
  process.env.IS_OFFLINE
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:8000',
      }
    : undefined
)

export const unmarshall = (response: any): any =>
  AWS.DynamoDB.Converter.unmarshall(response)

export const gateway = new AWS.ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.IS_OFFLINE
    ? 'http://localhost:3001'
    : 'https://stzj06gng1.execute-api.eu-west-1.amazonaws.com/msg/',
})
