import {
  Model,
  Mentor,
  List,
  SocialMedia,
  Tags,
  ProfilePicture,
  Invite,
  ConnectGoogle,
  SigninUpframe,
} from '.'

const regToStr = (reg: RegExp) => reg.toString().replace(/\/(.*)\//, '$1')

export class User extends Model {
  static tableName = 'users'
  static idColumn = 'id'

  id!: string
  handle!: string
  name!: string
  email!: string
  password: string
  role: string
  location: string
  biography: string
  allow_emails: boolean

  mentors?: Mentor
  socialmedia?: SocialMedia[]
  tags?: Tags[]
  profile_pictures?: ProfilePicture[]
  lists?: List[]
  invites?: Invite[]
  connect_google?: ConnectGoogle
  signin_upframe?: SigninUpframe

  static relationMappings = {
    mentors: {
      relation: Model.HasOneRelation,
      modelClass: Mentor,
      join: {
        from: 'users.id',
        to: 'mentors.id',
      },
    },
    socialmedia: {
      relation: Model.ManyToManyRelation,
      modelClass: SocialMedia,
      join: {
        from: 'users.id',
        through: {
          from: 'user_handles.user_id',
          to: 'user_handles.platform_id',
          extra: ['handle'],
        },
        to: 'socialmedia.id',
      },
    },
    tags: {
      relation: Model.ManyToManyRelation,
      modelClass: Tags,
      join: {
        from: 'users.id',
        through: {
          from: 'user_tags.user_id',
          to: 'user_tags.tag_id',
        },
        to: 'tags.id',
      },
    },
    profile_pictures: {
      relation: Model.HasManyRelation,
      modelClass: ProfilePicture,
      join: {
        from: 'users.id',
        to: 'profile_pictures.user_id',
      },
    },
    lists: {
      relation: Model.ManyToManyRelation,
      modelClass: List,
      join: {
        from: 'users.id',
        through: {
          from: 'user_lists.user_id',
          to: 'user_lists.list_id',
        },
        to: 'lists.id',
      },
    },
    invites: {
      relation: Model.HasManyRelation,
      modelClass: Invite,
      join: {
        from: 'users.id',
        to: 'invites.issuer',
      },
    },
    connect_google: {
      relation: Model.HasOneRelation,
      modelClass: ConnectGoogle,
      join: {
        from: 'users.id',
        to: 'connect_google.user_id',
      },
    },
    signin_upframe: {
      relation: Model.HasOneRelation,
      modelClass: SigninUpframe,
      join: {
        from: 'users.id',
        to: 'signin_upframe.user_id',
      },
    },
  }

  static jsonSchema = {
    type: 'object',
    required: ['id', 'handle', 'name', 'email'],
    properties: {
      id: {
        type: 'string',
      },
      handle: {
        type: 'string',
      },
      name: {
        type: 'string',
        minLength: 3,
      },
      email: {
        type: 'string',
        pattern: regToStr(
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        ),
      },
      website: {
        type: 'string',
        pattern: regToStr(
          /^(http(s?):\/\/)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){0,2}\.[a-z]{2,10}(\/([\w-.~!$&'()*+,;=:@]|(%[0-9a-fA-F]{2}))+)*\/?(\?[^?#]*)?(#(([\w!$&'()*+,;=\-.~:@/?]|(%[0-9a-fA-F]{2}))*))?$/
        ),
      },
      password: {
        type: 'string',
        minLength: 8,
      },
      role: {
        type: 'string',
        enum: ['user', 'mentor', 'nologin'],
      },
      location: {
        type: 'string',
      },
      biography: {
        type: 'string',
      },
      allow_emails: {
        type: 'boolean',
      },
    },
  }
}
