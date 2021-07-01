import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import InternetAccountType from '@jbrowse/core/pluggableElementTypes/InternetAccountType'
import {
  configSchemaFactory as OAuthConfigSchemaFactory,
  modelFactory as OAuthInternetAccountModelFactory,
} from './OAuthModel'
import {
  configSchemaFactory as ExternalTokenConfigSchemaFactory,
  modelFactory as ExternalTokenInternetAccountModelFactory,
} from './ExternalTokenModel'

export default class AuthenticationPlugin extends Plugin {
  name = 'AuthenticationPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addInternetAccountType(() => {
      const configSchema = OAuthConfigSchemaFactory(pluginManager)
      return new InternetAccountType({
        name: 'OAuthInternetAccount',
        configSchema: configSchema,
        stateModel: OAuthInternetAccountModelFactory(
          pluginManager,
          configSchema,
        ),
      })
    })
    pluginManager.addInternetAccountType(() => {
      const configSchema = ExternalTokenConfigSchemaFactory(pluginManager)
      return new InternetAccountType({
        name: 'ExternalTokenInternetAccount',
        configSchema: configSchema,
        stateModel: ExternalTokenInternetAccountModelFactory(
          pluginManager,
          configSchema,
        ),
      })
    })
  }
}
