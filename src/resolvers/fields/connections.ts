import resolver from '../resolver'

export const Connection = {
  __resolveType: resolver<string, any>()(() => ''),
}
export const Edge = {
  __resolveType: resolver<string, any>()(() => ''),
}
export const Node = {
  __resolveType: resolver<string, any>()(() => ''),
}
