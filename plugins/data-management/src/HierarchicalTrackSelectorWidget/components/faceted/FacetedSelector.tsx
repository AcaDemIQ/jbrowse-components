import React, { useMemo, useState, useEffect, useReducer } from 'react'
import { IconButton } from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { getRoot, resolveIdentifier } from 'mobx-state-tree'
import { DataGrid, GridCellParams, GridToolbar } from '@mui/x-data-grid'

// jbrowse
import { getTrackName } from '@jbrowse/core/util/tracks'
import { ResizeHandle } from '@jbrowse/core/ui'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import ResizeBar from '@jbrowse/core/ui/ResizeBar'
import {
  getEnv,
  getSession,
  measureGridWidth,
  useDebounce,
  useLocalStorage,
} from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { useResizeBar } from '@jbrowse/core/ui/useResizeBar'
import { makeStyles } from 'tss-react/mui'

// icons
import MoreHoriz from '@mui/icons-material/MoreHoriz'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import { matches } from '../../util'
import FacetedHeader from './FacetedHeader'
import FacetFilters from './FacetFilters'
import { getRootKeys } from './util'

const nonMetadataKeys = ['category', 'adapter', 'description'] as const

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

const frac = 0.75

const FacetedSelector = observer(function FacetedSelector({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const { view, selection } = model
  const { pluginManager } = getEnv(model)
  const { ref, scrollLeft } = useResizeBar()

  const [filterText, setFilterText] = useState('')
  const [showOptions, setShowOptions] = useLocalStorage(
    'facet-showTableOptions',
    false,
  )
  const [info, setInfo] = useState<InfoArgs>()
  const [useShoppingCart, setUseShoppingCart] = useState(false)
  const [showSparse, setShowSparse] = useLocalStorage('facet-showSparse', false)
  const [showFilters, setShowFilters] = useLocalStorage(
    'facet-showFilters',
    true,
  )
  const [panelWidth, setPanelWidth] = useLocalStorage('facet-panelWidth', 400)
  const session = getSession(model)
  const filterDebounced = useDebounce(filterText, 400)
  const tracks = view.tracks as AnyConfigurationModel[]
  const [filters, dispatch] = useReducer(
    (
      state: Record<string, string[]>,
      update: { key: string; val: string[] },
    ) => ({ ...state, [update.key]: update.val }),
    {},
  )

  const rows = useMemo(() => {
    // metadata is spread onto the object for easier access and sorting
    // by the mui data grid (it's unable to sort by nested objects)
    return model.trackConfigurations
      .filter(conf => matches(filterDebounced, conf, session))
      .map(track => {
        const metadata = readConfObject(track, 'metadata')
        return {
          id: track.trackId,
          conf: track,
          name: getTrackName(track, session),
          category: readConfObject(track, 'category')?.join(', '),
          adapter: readConfObject(track, 'adapter')?.type,
          description: readConfObject(track, 'description'),
          metadata,
          ...metadata,
        }
      })
  }, [model, filterDebounced, session])

  const filteredNonMetadataKeys = useMemo(
    () =>
      nonMetadataKeys.filter(f =>
        showSparse ? true : rows.map(r => r[f]).filter(f => !!f).length > 5,
      ),
    [showSparse, rows],
  )

  const filteredMetadataKeys = useMemo(
    () =>
      [...new Set(rows.flatMap(row => getRootKeys(row.metadata)))].filter(f =>
        showSparse
          ? true
          : rows.map(r => r.metadata[f]).filter(f => !!f).length > 5,
      ),
    [showSparse, rows],
  )

  const fields = useMemo(
    () => ['name', ...filteredNonMetadataKeys, ...filteredMetadataKeys],
    [filteredNonMetadataKeys, filteredMetadataKeys],
  )

  const [widths, setWidths] = useState({
    name:
      measureGridWidth(
        rows.map(r => r.name),
        { maxWidth: 500, stripHTML: true },
      ) + 15,
    ...Object.fromEntries(
      filteredNonMetadataKeys.map(e => [
        e,
        measureGridWidth(
          rows.map(r => r[e]),
          { maxWidth: 400, stripHTML: true },
        ),
      ]),
    ),
    ...Object.fromEntries(
      filteredMetadataKeys.map(e => [
        e,
        measureGridWidth(
          rows.map(r => r.metadata[e]),
          { maxWidth: 400, stripHTML: true },
        ),
      ]),
    ),
  } as Record<string, number | undefined>)

  const [visible, setVisible] = useState(
    Object.fromEntries(fields.map(c => [c, true])),
  )
  useEffect(() => {
    setVisible(visible => ({
      ...Object.fromEntries(fields.map(c => [c, true])),
      ...visible,
    }))
  }, [fields])

  useEffect(() => {
    setWidths(widths => ({
      name: widths.name,
      ...Object.fromEntries(
        filteredNonMetadataKeys
          .filter(f => visible[f])
          .map(e => [
            e,
            measureGridWidth(
              rows.map(r => r[e]),
              { stripHTML: true, maxWidth: 400 },
            ),
          ]),
      ),
      ...Object.fromEntries(
        filteredMetadataKeys
          .filter(f => visible[f])
          .map(e => [
            e,
            measureGridWidth(
              rows.map(r => r.metadata[e]),
              { stripHTML: true, maxWidth: 400 },
            ),
          ]),
      ),
    }))
  }, [filteredMetadataKeys, visible, filteredNonMetadataKeys, showSparse, rows])

  const widthsDebounced = useDebounce(widths, 200)

  const columns = [
    {
      field: 'name',
      hideable: false,
      renderCell: (params: GridCellParams) => {
        const { value, id, row } = params
        return (
          <div className={classes.cell}>
            <SanitizedHTML html={value as string} />
            <IconButton
              onClick={e =>
                setInfo({
                  target: e.currentTarget,
                  id: id as string,
                  conf: row.conf,
                })
              }
            >
              <MoreHoriz />
            </IconButton>
          </div>
        )
      },
      width: widthsDebounced.name ?? 100,
    },
    ...filteredNonMetadataKeys.map(e => ({
      field: e,
      width: widthsDebounced[e] ?? 100,
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return (
          <div className={classes.cell}>
            {value ? <SanitizedHTML html={value as string} /> : ''}
          </div>
        )
      },
    })),
    ...filteredMetadataKeys.map(e => ({
      field: e,
      width: widthsDebounced[e] ?? 100,
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return (
          <div className={classes.cell}>
            {value ? <SanitizedHTML html={value as string} /> : ''}
          </div>
        )
      },
    })),
  ]

  const shownTrackIds = new Set(
    tracks.map(t => t.configuration.trackId as string),
  )

  const arrFilters = Object.entries(filters)
    .filter(f => f[1].length > 0)
    .map(([key, val]) => [key, new Set<string>(val)] as const)
  const filteredRows = rows.filter(row =>
    arrFilters.every(([key, val]) => val.has(row[key] as string)),
  )
  return (
    <>
      {info ? (
        <JBrowseMenu
          anchorEl={info?.target}
          menuItems={session.getTrackActionMenuItems?.(info.conf) || []}
          onMenuItemClick={(_event, callback) => {
            callback()
            setInfo(undefined)
          }}
          open={!!info}
          onClose={() => setInfo(undefined)}
        />
      ) : null}
      <FacetedHeader
        setShowSparse={setShowSparse}
        setShowFilters={setShowFilters}
        setShowOptions={setShowOptions}
        setFilterText={setFilterText}
        setUseShoppingCart={setUseShoppingCart}
        showFilters={showFilters}
        showSparse={showSparse}
        showOptions={showOptions}
        filterText={filterText}
        useShoppingCart={useShoppingCart}
        model={model}
      />

      <div
        ref={ref}
        style={{
          display: 'flex',
          overflow: 'hidden',
          height: window.innerHeight * frac,
          width: window.innerWidth * frac,
        }}
      >
        <div
          style={{
            height: window.innerHeight * frac,
            width: window.innerWidth * frac - (showFilters ? panelWidth : 0),
          }}
        >
          <ResizeBar
            checkbox
            widths={Object.values(widths).map(f => f ?? 100)}
            setWidths={newWidths =>
              setWidths(
                Object.fromEntries(
                  Object.entries(widths).map((entry, idx) => [
                    entry[0],
                    newWidths[idx],
                  ]),
                ),
              )
            }
            scrollLeft={scrollLeft}
          />
          <DataGrid
            rows={filteredRows}
            columnVisibilityModel={visible}
            onColumnVisibilityModelChange={newModel => setVisible(newModel)}
            columnHeaderHeight={35}
            checkboxSelection
            disableRowSelectionOnClick
            keepNonExistentRowsSelected
            onRowSelectionModelChange={userSelectedIds => {
              if (!useShoppingCart) {
                const a1 = shownTrackIds
                const a2 = new Set(userSelectedIds as string[])
                // synchronize the user selection with the view
                // see share https://stackoverflow.com/a/33034768/2129219
                transaction(() => {
                  ;[...a1].filter(x => !a2.has(x)).map(t => view.hideTrack(t))
                  ;[...a2].filter(x => !a1.has(x)).map(t => view.showTrack(t))
                })
              } else {
                const root = getRoot(model)
                const schema = pluginManager.pluggableConfigSchemaType('track')
                const tracks = userSelectedIds.map(id =>
                  resolveIdentifier(schema, root, id),
                )
                model.setSelection(tracks)
              }
            }}
            rowSelectionModel={
              useShoppingCart
                ? selection.map(s => s.trackId)
                : [...shownTrackIds]
            }
            slots={{ toolbar: showOptions ? GridToolbar : null }}
            slotProps={{
              toolbar: { printOptions: { disableToolbarButton: true } },
            }}
            columns={columns}
            rowHeight={25}
          />
        </div>

        {showFilters ? (
          <>
            <ResizeHandle
              vertical
              onDrag={dist => setPanelWidth(panelWidth - dist)}
              style={{ marginLeft: 5, background: 'grey', width: 5 }}
            />
            <div
              style={{
                width: panelWidth,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <FacetFilters
                width={panelWidth - 10}
                rows={rows}
                columns={columns}
                dispatch={dispatch}
                filters={filters}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  )
})

export default FacetedSelector
