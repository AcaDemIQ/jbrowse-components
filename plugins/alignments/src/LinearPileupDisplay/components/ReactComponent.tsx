import React, { useCallback } from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// local
import { LinearPileupDisplayModel } from '../model'
import BaseDisplayComponent from '../../shared/BaseDisplayComponent'

type LGV = LinearGenomeViewModel

const LinearPileupRendering = observer(function ({
  model,
}: {
  model: LinearPileupDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.height
  const cb = useCallback(
    (ref: HTMLCanvasElement) => model.setRef(ref),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, width, height],
  )

  // note: the position absolute below avoids scrollbar from appearing on track
  return (
    <canvas
      data-testid="pileup-canvas"
      ref={cb}
      style={{ width, height, position: 'absolute' }}
      width={width * 2}
      height={height * 2}
    />
  )
})

export default observer(function ({
  model,
}: {
  model: LinearPileupDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <LinearPileupRendering model={model} />
    </BaseDisplayComponent>
  )
})