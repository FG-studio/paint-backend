import * as url from 'url'
import * as Minio from 'minio'
import { Readable } from 'stream'
import { getLogger } from 'helpers'

export class StorageController {
  private _client: Minio.Client
  private _bucket
  private _logger = getLogger('')
  constructor(private _endpoint: url.URL) {
    this._client = new Minio.Client({
      endPoint: _endpoint.hostname,
      useSSL: _endpoint.protocol === 'https:',
      port: parseInt(
        _endpoint.port || (_endpoint.protocol === 'https:' ? '443' : '80'),
      ),
      accessKey: _endpoint.username,
      secretKey: _endpoint.password,
    })
    this._bucket = _endpoint.pathname.substring(1)
  }

  putFile(
    stream: Readable | Buffer | string,
    dest: string,
    metadata?: any,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this._client.putObject(this._bucket, dest, stream, metadata, (err) => {
        if (err) {
          this._logger.error(err, `upload file ${dest} error`)
          return reject(err)
        }
        return resolve()
      })
    })
  }

  getPublicLink(src: string): string {
    return `${this._endpoint.protocol}//${this._endpoint.host}/${this._bucket}/${src}`
  }
}
