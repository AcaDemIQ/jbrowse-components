import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

// locals
import stateModelFactory from './model'
import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearVariantMatrixDisplay',
      displayName: 'Matrix display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}