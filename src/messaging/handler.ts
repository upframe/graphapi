import 'source-map-support/register'
import logger from '~/logger'
import uuidv4 from 'uuid/v4'
import { parse, getOperationAST, validate, subscribe } from 'graphql'
import { APIGatewayEvent, DynamoDBStreamEvent } from 'aws-lambda'
import { gateway } from '../utils/aws'
import { schema } from '../apollo'
import Client from './client'
import handleDbRecord from './dbEvent'
import { unmarshall } from '~/utils/aws'
import { format } from './dbOps'

export const wsConnect = async (event: APIGatewayEvent) => {
  const response = (opts = {}) => ({
    ...opts,
    statusCode: 200,
    ...(event.headers?.['Sec-WebSocket-Protocol'] && {
      headers: {
        'Sec-WebSocket-Protocol': event.headers['Sec-WebSocket-Protocol'],
      },
    }),
  })

  try {
    if (event.requestContext.eventType === 'CONNECT') {
      await new Client(event.requestContext.connectionId).connect()
      return response({ body: 'Connected.' })
    } else if (event.requestContext.eventType === 'DISCONNECT') {
      await new Client(event.requestContext.connectionId).disconnect()
      return response()
    }

    const rootValue = JSON.parse(event.body)

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
      return response()
    }

    if (!rootValue.payload) return response()

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

    const res = await subscribe({
      document,
      schema,
      rootValue,
      operationName,
      variableValues,
      contextValue: {
        connectionId: event.requestContext.connectionId,
        subscriptionId: rootValue.id,
      },
    })
    if ((res as any)?.errors?.length) throw (res as any).errors[0]

    return response()
  } catch (error) {
    logger.error(error)
    throw error
  }
}

export const dbEvent = async (event: DynamoDBStreamEvent) => {
  try {
    await Promise.allSettled(
      event.Records.map(({ dynamodb, eventName }) =>
        handleDbRecord(
          eventName,
          format(unmarshall(dynamodb.NewImage)),
          dynamodb.OldImage && format(unmarshall(dynamodb.OldImage))
        )
      )
    )
  } catch (error) {
    logger.error(error)
    throw error
  }
}
