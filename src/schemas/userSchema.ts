import { Model, model, Schema } from 'mongoose'
import { DataBaseUser } from '../../typings'

const UserSchema: Schema<DataBaseUser> = new Schema({
  _id: String,
  id: String,
  email: String,
  token: String,
  naver_accessToken: String,
  naver_refreshToken: String,
  naver_email: String,
  naver_name: String,
  tokenExp: Number,
  accessToken: String,
  refreshToken: String,
  expires_in: Number,
  published_date: { type: Date, default: Date.now },
}, {collection: 'userData'});

const User: Model<DataBaseUser> = model(
  'userData',
  UserSchema,
  'userData'
)
export default User