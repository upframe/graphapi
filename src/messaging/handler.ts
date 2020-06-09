import uuidv4 from 'uuid/v4'
import { parse, getOperationAST, validate, subscribe } from 'graphql'
import { APIGatewayEvent, DynamoDBStreamEvent } from 'aws-lambda'
import { gateway } from '../utils/aws'
import { schema } from '../apollo'
import logger from '../logger'
import Client from './client'

export const wsConnect = async (event: APIGatewayEvent) => {
  try {
    logger.info(`!WSCONNECT ${event.requestContext.eventType}`)
    if (event.requestContext.eventType === 'CONNECT')
      await new Client(event.requestContext.connectionId).connect()
    else if (event.requestContext.eventType === 'DISCONNECT')
      await new Client(event.requestContext.connectionId).disconnect()
    else {
      const rootValue = JSON.parse(event.body)
      logger.info(rootValue)
      if (rootValue?.type === 'connection_init') {
        await gateway
          .postToConnection({
            ConnectionId: event.requestContext.connectionId,
            Data: JSON.stringify({
              id: uuidv4(),
              type: 'connection_ack',
              payload: {},
            }),
          })
          .promise()
        return { statusCode: 200 }
      }

      const {
        query,
        variables: variableValues,
        operationName,
      } = rootValue.payload
      const document = parse(query)
      const operationAST = getOperationAST(document, rootValue.operationName)

      if (operationAST?.operation !== 'subscription')
        throw Error('operation must be subscription')

      const validationErrors = validate(schema, document)

      if (validationErrors.length) {
        logger.error('validation error', { validationErrors })
        throw new Error('validation errors')
      }

      await subscribe({
        document,
        schema,
        rootValue,
        operationName,
        variableValues,
        contextValue: {
          connectionId: event.requestContext.connectionId,
        },
      })
    }
    return { statusCode: 200 }
  } catch (error) {
    logger.error(error.toString())
    throw error
  }
}

export const message = async (event: DynamoDBStreamEvent) => {
  event.Records.forEach(record => {
    logger.info(record.dynamodb.NewImage)
  })
}
