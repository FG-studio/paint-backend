import path from 'path'
import * as url from 'url'
import * as dotenv from 'dotenv'

const envPath = path.join(
  process.cwd(),
  `.env${process.env.ENV === 'test' ? '.test' : ''}`,
)
dotenv.config({
  path: envPath,
  override: true,
})

export const NAMESPACE = 'paint-game-backend'
export const ENV = process.env.ENV || 'develop'
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
export const DEBUG = process.env.DEBUG === 'true'
export const PORT = parseInt(process.env.PORT || '8080')
export const SWAGGER_ENDPOINT = process.env.SWAGGER_ENDPOINT
export const WS_ENDPOINT = process.env.WS_ENDPOINT || 'ws://localhost:8080'
export const STORAGE_ENDPOINT = new url.URL(
  process.env.STORAGE_ENDPOINT ||
    'http://hieunq:1qazxsw2@localhost:9000/secret_word',
)
