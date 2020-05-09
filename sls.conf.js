const config = {
  offline: {
    DD_FLUSH: false,
    DD_ENHANCED: false,
    DD_LOG_INJECT: false,
    DD_ENV: 'local',
    DD_LAYERS: false,
  },

  online: {
    DD_FLUSH: true,
    DD_ENHANCED: true,
    DD_LOG_INJECT: true,
    DD_LAYERS: true,
  },

  dev: {
    DD_ENV: 'beta',
  },

  prod: {
    DD_ENV: 'prod',
  },
}

const get = field => sls => {
  const stage = sls.processedInput.options.stage || sls.service.provider.stage
  const val =
    field in config[stage] ? config[stage][field] : config.online[field]
  console.log(`${field}=${val}`)
  return val
}

module.exports = Object.fromEntries(
  Array.from(
    new Set(Object.values(config).flatMap(stage => Object.keys(stage)))
  ).map(field => [field, get(field)])
)
