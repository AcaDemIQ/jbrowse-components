import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

// locals
import { matches } from './util'

function sortConfs(
  confs: AnyConfigurationModel[],
  sortNames: boolean,
  sortCategories: boolean,
) {
  // uses readConfObject instead of getTrackName so that the undefined
  // reference sequence track is sorted to the top
  const ret = confs.map(c => [
    c,
    readConfObject(c, 'name'),
    readConfObject(c, 'category')?.[0] || '',
    readConfObject(c, 'category')?.[1] || '',
    readConfObject(c, 'category')?.[2] || '',
  ])
  if (sortNames) {
    ret.sort((a, b) => a[1].localeCompare(b[1]))
  }
  if (sortCategories) {
    // sort up to three sub-category levels, harder to code it to go deeper
    // than this and likely rarely used
    ret.sort((a, b) => {
      if (a[2] !== b[2]) {
        return a[2].localeCompare(b[2])
      } else if (a[3] !== b[3]) {
        return a[3].localeCompare(b[3])
      } else if (a[4] !== b[4]) {
        return a[4].localeCompare(b[4])
      }
      return 0
    })
  }
  return ret.map(a => a[0])
}

export interface TreeNode {
  name: string
  id: string
  conf?: AnyConfigurationModel
  checked?: boolean
  isOpenByDefault?: boolean
  children: TreeNode[]
}

export function generateHierarchy({
  model,
  trackConfs,
  extra,
}: {
  model: {
    filterText: string
    activeSortTrackNames: boolean
    activeSortCategories: boolean
    collapsed: Map<string, boolean>
    view?: {
      tracks: { configuration: AnyConfigurationModel }[]
    }
  }
  trackConfs: AnyConfigurationModel[]
  extra?: string
}): TreeNode[] {
  const hierarchy = { children: [] as TreeNode[] } as TreeNode
  const {
    collapsed,
    filterText,
    activeSortTrackNames,
    activeSortCategories,
    view,
  } = model
  if (!view) {
    return []
  }
  const session = getSession(model)
  const viewTracks = view.tracks
  const confs = trackConfs.filter(conf => matches(filterText, conf, session))

  // uses getConf
  for (const conf of sortConfs(
    confs,
    activeSortTrackNames,
    activeSortCategories,
  )) {
    // copy the categories since this array can be mutated downstream
    const categories = [...(readConfObject(conf, 'category') || [])]

    // hack where if trackId ends with sessionTrack, then push it to a
    // category that starts with a space to force sort to the top
    if (conf.trackId.endsWith('sessionTrack')) {
      categories.unshift(' Session tracks')
    }

    let currLevel = hierarchy

    // find existing category to put track into or create it
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]
      const ret = currLevel.children.find(c => c.name === category)
      const id = [extra, categories.slice(0, i + 1).join(',')]
        .filter(f => !!f)
        .join('-')
      if (!ret) {
        const n = {
          children: [],
          name: category,
          id,
          isOpenByDefault: !collapsed.get(id),
        }
        currLevel.children.push(n)
        currLevel = n
      } else {
        currLevel = ret
      }
    }

    // uses splice to try to put all leaf nodes above "category nodes" if you
    // change the splice to a simple push and open
    // test_data/test_order/config.json you will see the weirdness
    const r = currLevel.children.findIndex(elt => elt.children.length)
    const idx = r === -1 ? currLevel.children.length : r
    currLevel.children.splice(idx, 0, {
      id: conf.trackId,
      name: getTrackName(conf, session),
      conf,
      checked: viewTracks.some(f => f.configuration === conf),
      children: [],
    })
  }

  return hierarchy.children
}
