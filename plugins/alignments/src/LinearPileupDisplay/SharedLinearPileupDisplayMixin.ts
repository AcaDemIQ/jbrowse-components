import { lazy } from 'react'
import { autorun, observable } from 'mobx'
import { cast, types, addDisposer, getSnapshot } from 'mobx-state-tree'
import copy from 'copy-to-clipboard'
import {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  getEnv,
  getSession,
  isSessionModelWithWidgets,
  getContainingView,
  SimpleFeature,
  Feature,
} from '@jbrowse/core/util'

import {
  LinearGenomeViewModel,
  TrackHeightMixin,
  FeatureDensityMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'

// icons
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import LinearPileupDisplayBlurb from './components/LinearPileupDisplayBlurb'
import { getUniqueTagValues, FilterModel } from '../shared'
import { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import { createAutorun } from '../util'
import { ColorByModel, ExtraColorBy } from '../shared/color'

// async
const FilterByTagDlg = lazy(() => import('../shared/FilterByTag'))
const ColorByTagDlg = lazy(() => import('./components/ColorByTag'))
const SetFeatureHeightDlg = lazy(() => import('./components/SetFeatureHeight'))
const SetMaxHeightDlg = lazy(() => import('./components/SetMaxHeight'))

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

type LGV = LinearGenomeViewModel

export interface Filter {
  flagInclude: number
  flagExclude: number
  readName?: string
  tagFilter?: { tag: string; value: string }
}

/**
 * #stateModel SharedLinearPileupDisplayMixin
 * #category display
 * extends `BaseLinearDisplay`
 */
export function SharedLinearPileupDisplayMixin(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        featureHeight: types.maybe(types.number),
        /**
         * #property
         */
        noSpacing: types.maybe(types.boolean),
        /**
         * #property
         */
        fadeLikelihood: types.maybe(types.boolean),
        /**
         * #property
         */
        trackMaxHeight: types.maybe(types.number),
        /**
         * #property
         */
        colorBy: ColorByModel,
        /**
         * #property
         */
        filterBy: types.optional(FilterModel, {}),
      }),
    )
    .volatile(() => ({
      colorTagMap: observable.map<string, string>({}),
      featureUnderMouseVolatile: undefined as undefined | Feature,
      tagsReady: false,

      contextMenuFeature: undefined as Feature | undefined,
      featureIdUnderMouse: undefined as string | undefined,
      ref: null as HTMLCanvasElement | null,

      loading: false,
      lastDrawnOffsetPx: undefined as number | undefined,
      lastDrawnBpPerPx: 0,
    }))
    .views(self => ({
      get autorunReady() {
        const view = getContainingView(self) as LGV
        return (
          view.initialized &&
          self.featureDensityStatsReady &&
          !self.regionTooLarge
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * internal, a reference to a HTMLCanvas because we use a autorun to draw
       * the canvas
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
      },
      /**
       * #action
       */
      setContextMenuFeature(feature: Feature) {
        self.contextMenuFeature = feature
      },

      /**
       * #action
       */
      clearFeatureSelection() {
        // self.selection = undefined
      },
      /**
       * #action
       */
      setLastDrawn(offsetPx: number, bpPerPx: number) {
        self.lastDrawnOffsetPx = offsetPx
        self.lastDrawnBpPerPx = bpPerPx
      },
      /**
       * #action
       */
      setTagsReady(flag: boolean) {
        self.tagsReady = flag
      },

      /**
       * #action
       */
      setMaxHeight(n: number) {
        self.trackMaxHeight = n
      },

      /**
       * #action
       */
      setFeatureHeight(n?: number) {
        self.featureHeight = n
      },

      /**
       * #action
       */
      setNoSpacing(flag?: boolean) {
        self.noSpacing = flag
      },

      /**
       * #action
       */
      setColorScheme(colorScheme: {
        type: string
        tag?: string
        extra?: ExtraColorBy
      }) {
        self.colorTagMap = observable.map({}) // clear existing mapping
        self.colorBy = cast(colorScheme)
        if (colorScheme.tag) {
          self.tagsReady = false
        }
      },

      /**
       * #action
       */
      updateColorTagMap(uniqueTag: string[]) {
        // pale color scheme
        // https://cran.r-project.org/web/packages/khroma/vignettes/tol.html
        // e.g. "tol_light"
        const colorPalette = [
          '#BBCCEE',
          'pink',
          '#CCDDAA',
          '#EEEEBB',
          '#FFCCCC',
          'lightblue',
          'lightgreen',
          'tan',
          '#CCEEFF',
          'lightsalmon',
        ]

        uniqueTag.forEach(value => {
          if (!self.colorTagMap.has(value)) {
            const totalKeys = [...self.colorTagMap.keys()].length
            self.colorTagMap.set(value, colorPalette[totalKeys])
          }
        })
      },

      /**
       * #action
       */
      setFeatureUnderMouse(feat?: Feature) {
        self.featureUnderMouseVolatile = feat
      },

      /**
       * #action
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'AlignmentsFeatureWidget',
            'alignmentFeature',
            { featureData: feature.toJSON(), view: getContainingView(self) },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },

      /**
       * #action
       * uses copy-to-clipboard and generates notification
       */
      copyFeatureToClipboard(feature: Feature) {
        const { uniqueId, ...rest } = feature.toJSON()
        const session = getSession(self)
        copy(JSON.stringify(rest, null, 4))
        session.notify('Copied to clipboard', 'success')
      },

      /**
       * #action
       */
      setConfig(conf: AnyConfigurationModel) {
        self.configuration = conf
      },

      /**
       * #action
       */
      setFilterBy(filter: Filter) {
        self.filterBy = cast(filter)
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const { featureHeight, noSpacing, trackMaxHeight, rendererTypeName } =
          self
        const configBlob = getConf(self, ['renderers', rendererTypeName]) || {}
        return self.rendererType.configSchema.create(
          {
            ...configBlob,
            ...(featureHeight !== undefined ? { height: featureHeight } : {}),
            ...(noSpacing !== undefined ? { noSpacing } : {}),
            ...(trackMaxHeight !== undefined
              ? { maxHeight: trackMaxHeight }
              : {}),
          },
          getEnv(self),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get maxHeight() {
        return readConfObject(self.rendererConfig, 'maxHeight')
      },

      /**
       * #getter
       */
      get featureHeightSetting() {
        return readConfObject(self.rendererConfig, 'height')
      },
      /**
       * #getter
       */
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
      },
      /**
       * #getter
       */
      renderReady() {
        return self.tagsReady
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self

      return {
        /**
         * #getter
         */
        get rendererTypeName() {
          const viewName = getConf(self, 'defaultRendering')
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType) {
            throw new Error(`unknown alignments view name ${viewName}`)
          }
          return rendererType
        },

        /**
         * #method
         */
        contextMenuItems() {
          const feat = self.contextMenuFeature
          return feat
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: (): void => {
                    self.clearFeatureSelection()
                    if (feat) {
                      self.selectFeature(feat)
                    }
                  },
                },
                {
                  label: 'Copy info to clipboard',
                  icon: ContentCopyIcon,
                  onClick: (): void => {
                    if (feat) {
                      self.copyFeatureToClipboard(feat)
                    }
                  },
                },
              ]
            : []
        },

        /**
         * #getter
         */
        get DisplayBlurb() {
          return LinearPileupDisplayBlurb
        },
        /**
         * #method
         */
        renderPropsPre() {
          const { colorTagMap, colorBy, filterBy, rpcDriverName } = self

          const superProps = superRenderProps()
          return {
            ...superProps,
            notReady: superProps.notReady || !self.renderReady(),
            rpcDriverName,
            displayModel: self,
            colorBy: colorBy ? getSnapshot(colorBy) : undefined,
            filterBy: JSON.parse(JSON.stringify(filterBy)),
            colorTagMap: Object.fromEntries(colorTagMap.toJSON()),
            config: self.rendererConfig,
            async onFeatureClick(_: unknown, featureId?: string) {
              const session = getSession(self)
              const { rpcManager } = session
              try {
                const f = featureId || self.featureIdUnderMouse
                if (!f) {
                  self.clearFeatureSelection()
                } else {
                  const sessionId = getRpcSessionId(self)
                  const { feature } = (await rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId: f,
                      sessionId,
                      layoutId: getContainingView(self).id,
                      rendererType: 'PileupRenderer',
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  if (feature) {
                    self.selectFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notify(`${e}`)
              }
            },

            onClick() {
              self.clearFeatureSelection()
            },
            // similar to click but opens a menu with further options
            async onFeatureContextMenu(_: unknown, featureId?: string) {
              const session = getSession(self)
              const { rpcManager } = session
              try {
                const f = featureId || self.featureIdUnderMouse
                if (!f) {
                  self.clearFeatureSelection()
                } else {
                  const sessionId = getRpcSessionId(self)
                  const { feature } = (await rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId: f,
                      sessionId,
                      layoutId: getContainingView(self).id,
                      rendererType: 'PileupRenderer',
                    },
                  )) as { feature: SimpleFeatureSerialized }

                  if (feature) {
                    self.setContextMenuFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notify(`${e}`)
              }
            },
          }
        },

        /**
         * #method
         */
        colorSchemeSubMenuItems() {
          return [
            {
              label: 'Normal',
              onClick: () => self.setColorScheme({ type: 'normal' }),
            },
            {
              label: 'Mapping quality',
              onClick: () => self.setColorScheme({ type: 'mappingQuality' }),
            },
            {
              label: 'Strand',
              onClick: () => self.setColorScheme({ type: 'strand' }),
            },
            {
              label: 'Per-base quality',
              onClick: () => self.setColorScheme({ type: 'perBaseQuality' }),
            },
            {
              label: 'Per-base lettering',
              onClick: () => self.setColorScheme({ type: 'perBaseLettering' }),
            },
            {
              label: 'First-of-pair strand',
              onClick: () => self.setColorScheme({ type: 'stranded' }),
            },
            {
              label: 'Color by tag...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ColorByTagDlg,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },

        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Filter by',
              icon: FilterListIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  FilterByTagDlg,
                  { model: self, handleClose },
                ])
              },
            },
            {
              label: 'Set feature height',
              subMenu: [
                {
                  label: 'Normal',
                  onClick: () => {
                    self.setFeatureHeight(7)
                    self.setNoSpacing(false)
                  },
                },
                {
                  label: 'Compact',
                  onClick: () => {
                    self.setFeatureHeight(2)
                    self.setNoSpacing(true)
                  },
                },
                {
                  label: 'Manually set height',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      SetFeatureHeightDlg,
                      { model: self, handleClose },
                    ])
                  },
                },
              ],
            },
            {
              label: 'Set max height...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetMaxHeightDlg,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },
      }
    })
    .views(self => ({
      renderProps() {
        return self.renderPropsPre()
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { linearPileupAfterAttach } = await import('./afterAttach')
            linearPileupAfterAttach(self)
          } catch (e) {
            self.setError(e)
            console.error(e)
          }
        })()
      },
    }))
}