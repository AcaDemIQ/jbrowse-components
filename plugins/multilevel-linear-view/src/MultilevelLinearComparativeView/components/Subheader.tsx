import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { IconButton } from '@mui/material'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import MenuIcon from '@mui/icons-material/Menu'
import Menu from '@jbrowse/core/ui/Menu'

import { LinearGenomeMultilevelViewModel } from '../../LinearGenomeMultilevelView/model'
import { MultilevelLinearComparativeViewModel } from '../model'
import LabelField from './LabelField'
import Controls from './Controls'

type LCV = MultilevelLinearComparativeViewModel
type LGV = LinearGenomeMultilevelViewModel

const ExtraButtons = observer(({ view }: { view: LGV }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  return (
    <>
      <IconButton
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
        title="Open view menu"
      >
        <MenuIcon color="secondary" />
      </IconButton>
      <IconButton
        onClick={() => {
          view.toggleVisible()
        }}
        title="Toggle show/hide view"
      >
        {view.isVisible ? (
          <UnfoldLessIcon color="secondary" />
        ) : (
          <>
            <UnfoldMoreIcon color="secondary" />
          </>
        )}
      </IconButton>

      <LabelField model={view} />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setAnchorEl(undefined)
        }}
        onClose={() => {
          setAnchorEl(undefined)
        }}
        menuItems={view.menuItems()}
      />
    </>
  )
})

const Subheader = observer(
  ({
    model,
    view,
    polygonPoints,
  }: {
    model: LCV
    view: LGV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polygonPoints: any
  }) => {
    return (
      <Controls
        model={model}
        view={view}
        polygonPoints={polygonPoints}
        ExtraButtons={<ExtraButtons view={view} />}
      />
    )
  },
)

export default Subheader