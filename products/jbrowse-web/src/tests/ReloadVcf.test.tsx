import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import {
  setup,
  generateReadBuffer,
  doBeforeEach,
  hts,
  createView,
  mockConsole,
} from './util'

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('reloads vcf (VCF.GZ 404)', async () => {
  await mockConsole(async () => {
    // @ts-ignore
    fetch.mockResponse(async request => {
      if (request.url === 'volvox.filtered.vcf.gz') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      createView()
    await findByText('Help')
    view.setNewView(0.05, 5000)
    fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)

    // @ts-ignore
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])

    await findAllByTestId('box-test-vcf-604452', ...opts)
  })
}, 20000)

test('reloads vcf (VCF.GZ.TBI 404)', async () => {
  await mockConsole(async () => {
    // @ts-ignore
    fetch.mockResponse(async request => {
      if (request.url === 'volvox.filtered.vcf.gz.tbi') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { view, findByTestId, findByText, findAllByTestId, findAllByText } =
      createView()
    await findByText('Help')
    view.setNewView(0.05, 5000)
    fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), ...opts))
    await findAllByText(/HTTP 404/, ...opts)
    // @ts-ignore
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])

    await findAllByTestId('box-test-vcf-604452', ...opts)
  })
}, 20000)