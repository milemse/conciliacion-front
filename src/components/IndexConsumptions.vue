<script setup>
import { ref, onBeforeMount, onUnmounted } from 'vue'

import { open } from '@tauri-apps/plugin-dialog'
import Database from '@tauri-apps/plugin-sql'
import { invoke } from '@tauri-apps/api/core'

import { read } from 'xlsx'
import { readFile, readTextFile } from '@tauri-apps/plugin-fs'
import { writeTextFile } from '@tauri-apps/plugin-fs'

import { downloadConsumptions } from '../services/excel'
import { linker_consumptions } from '../utils/linker_consumptions'

const structuredQueries = {
  general: {
    query: `select cl.client_id, cn.consumption_id, rd.reading_id, cl.identifier, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department, acc.reference_bbva as reference, cn.total from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id where rd.period_id = $1 order by department asc`,
    queryClientInformation: `select cl.client_id, cn.consumption_id, rd.reading_id, cl.identifier, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department, acc.reference_bbva as reference, cn.total, cn.debt, cn.liters, acc.account_id from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id where rd.period_id = $1 and cl.client_id = $2`,
    count: `select count(*) as consumptions_count from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id where rd.period_id = $1`
  },
  block: {
    query: `select cl.client_id, cn.consumption_id, rd.reading_id, cl.identifier, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department, acc.reference_bbva as reference, cn.total from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id join main.period pr on pr.period_id = rd.period_id where cd.block = $1 order by department asc`,
    count: `select count(*) as consumptions_count from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id join main.period pr on pr.period_id = rd.period_id where cd.block = $1`
  },
  blockAndCondominium: {
    query: `select cl.client_id, cn.consumption_id, rd.reading_id, cl.identifier, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department, acc.reference_bbva as reference, cn.total from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id join main.period pr on pr.period_id = rd.period_id where cd.block = $1 and cd.condominium_id = $2 order by department asc`,
    count: `select count(*) as consumptions_count from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id join main.period pr on pr.period_id = rd.period_id where cd.block = $1 and cd.condominium_id = $2`
  },
  blockAndPeriod: {
    query: `select cl.client_id, cn.consumption_id, rd.reading_id, cl.identifier, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department, acc.reference_bbva as reference, cn.total from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id join main.period pr on pr.period_id = rd.period_id where cd.block = $1 and pr.period_id = $2 order by department asc`,
    count: `select count(*) as consumptions_count from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id join main.period pr on pr.period_id = rd.period_id where cd.block = $1 and pr.period_id = $2`
  },
  blockAndCondominiumAndPeriod: {
    query: `select cl.client_id, cn.consumption_id, rd.reading_id, cl.identifier, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department, acc.reference_bbva as reference, cn.total from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id join main.period pr on pr.period_id = rd.period_id where cd.block = $1 and pr.period_id = $2 and cd.condominium_id = $3 order by department asc`,
    count: `select count(*) as consumptions_count from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id join main.period pr on pr.period_id = rd.period_id where cd.block = $1 and pr.period_id = $2 and cd.condominium_id = $3` 
  },
  payments: {
    queryAssigned: `select py.reference, py.payment_id, py.account_id, py.amount, py.description, py.done_at, py.type_identificacion, acc.reference_bbva from main.payment py join main.account acc on acc.account_id = py.account_id where py.account_id is not null and acc.reference_bbva = $1`,
    queryNotAssigned: `select py.reference, py.payment_id, py.account_id, py.amount, py.description, py.done_at from main.payment py where py.account_id is null`,
    queryByClient: `select py.reference, py.payment_id, py.account_id, py.amount, py.description, py.done_at, py.type_identificacion, acc.reference_bbva from main.payment py join main.account acc on acc.account_id = py.account_id where py.account_id is not null and acc.client_id = $1`,
    queryByClientPeriod: `select py.reference, py.payment_id, py.account_id, py.amount, py.description, py.done_at, py.type_identificacion, acc.reference_bbva from main.payment py join main.account acc on acc.account_id = py.account_id where py.account_id is not null and acc.client_id = $1 and py.done_at >= (select initial from main.period where period_id = $2) and py.done_at <= (select final from main.period where period_id = $3)`,
    queryAssignPayment: `update main.payment set account_id = $1, type_identificacion = 'am' where payment_id = $2`,
    queryDeletePayment: `update main.payment set account_id = null where payment_id = $1`
  },
  total: {
    query: `select cl.client_id, sum(py.amount) as total from main.client cl join main.account acc on acc.client_id = cl.client_id join main.payment py on py.account_id = acc.account_id where cl.client_id = $1 group by cl.client_id`,
    queryPeriod: `select cl.client_id, sum(py.amount) as total from main.client cl join main.account acc on acc.client_id = cl.client_id join main.payment py on py.account_id = acc.account_id where cl.client_id = $1 and py.done_at >= (select initial from main.period where period_id = $2) and py.done_at <= (select final from main.period where period_id = $3) group by cl.client_id`
  },
  delete: {
    consumption: `delete from main.consumption where consumption_id = $1`,
    reading: `delete from main.reading where reading_id = $1`
  }
}

const menuUI = {
  search: {
    id: 'search',
    description: 'Buscar',
    classes: 'title text-md font-light ml-2',
    ui: ''
  },
  conciliate: {
    id: 'conciliate',
    description: 'Conciliar',
    classes: 'title text-md font-light ml-2',
    ui: ''
  },
  filter: {
    id: 'filter',
    description: 'Filtrar',
    classes: 'title text-md font-light ml-2',
    ui: ''
  },
  period: {
    id: 'period',
    description: 'Periodos',
    classes: 'title text-md font-light ml-2',
    ui: ''
  },
  payments: {
    id: 'payments',
    description: 'Pagos',
    classes: 'title text-md font-light ml-2',
    ui: ''
  },
  cash: {
    id: 'cash',
    description: 'Efectivo',
    classes: 'title text-md font-light ml-2',
    ui: ''
  },
  exportFile: {
    id: 'exportFile',
    description: 'Exportar',
    classes: 'title text-md font-light ml-2',
    ui: ''
  }
}
const filterPills = ref({
  block: {
    id: 'block',
    pseudo_id: 'bq',
    name: 'Bloque',
    classes: 'flex text-xs border border-slate-400 text-slate-600 font-semibold rounded-xl w-20 p-1 m-2 gap-2',
    description: 'Selecione un bloque',
    options: [{ id: '1', name: 'Bloque 1' }, { id: '2', name: 'Bloque 2' }, { id: '3', name: 'Bloque 3' }, { id: '4', name: 'Bloque 4' }]
  },
  condominium: {
    id: 'condominium',
    pseudo_id: 'cd',
    name: 'Condominio',
    classes: 'flex text-xs border border-slate-400 text-slate-600 font-semibold rounded-xl w-28 p-1 m-2 gap-2',
    description: 'Selecione un condominio',
    options: []
  },
  period: {
    id: 'period',
    pseudo_id: 'pr',
    name: 'Periodo',
    classes: 'flex text-xs border border-slate-400 text-slate-600 font-semibold rounded-xl w-20 p-1 m-2 gap-2',
    description: 'Selecione un periodo',
    options: []
  }
})
let DB = { }
const typeUI = ref('') // conciliate-consumptions, filter-consumptions, exportFile-consumptions
const typeFilter = ref('') // block, condominium, period
const filters = ref([]) // { id, name, classes, description, options }
let queryParams = [] // { filter, value }
let filterValues = []

const exportFilePath = ref('')
const exportFileName = ref('')

// consumos
const consumptions = ref([])
const payments = ref([])
const client = ref({  })
const global_client_id = ref(0)
const period = ref({  })
const consumptions_count = ref(0)
const current_consumptions = ref(0)
const salt_consumptions = ref(10)
const periods = ref([])

const periodPayments = ref(false)

const notification = ref({
  title: '',
  description: ''
})

let queryConsumptions = structuredQueries.general.query
let queryConsumptionsCount = structuredQueries.general.count

let PROVEE_TEST = ''
let HOST_FROM_EXPORT = ''

// metodos select() y execute()
onBeforeMount(async function(){
  PROVEE_TEST = await invoke('get_enviroment_variable', { name: 'PROVEE_TEST' })
  HOST_FROM_EXPORT = await invoke('get_enviroment_variable', { name: 'HOST_FROM_EXPORT' })
  DB = await Database.load(PROVEE_TEST)

  const textParams = await readTextFile('params.json')
  const toLoad = JSON.parse(textParams)
  queryParams = toLoad.queryParams
  filterValues = toLoad.filterValues

  period.value = await getLastPeriod()

  const tempPeriods = await getAllPeriods()
  filterPills.value['period'].options = tempPeriods

  const temp_consumptions_count = await DB.select(queryConsumptionsCount, [period.value.period_id])
  consumptions_count.value = temp_consumptions_count.shift().consumptions_count
  const selectConsumptions = `${queryConsumptions} limit ${salt_consumptions.value}`
  const tempConsumptions = await DB.select(selectConsumptions, [period.value.period_id])

  for (let item of tempConsumptions){
    item.checked = false
    const total = await DB.select(structuredQueries.total.queryPeriod, [item.client_id, period.value.period_id, period.value.period_id])
    if(total.length > 0)
      item.total_payment = total.shift().total.toFixed(2)
    else
      item.total_payment = 0
  }

  consumptions.value = tempConsumptions

  await filter()
})

onUnmounted(async () => {
  const toSave = {
    queryParams,
    filterValues,
  }

  await writeTextFile('params.json', JSON.stringify(toSave))
  await DB.close()
})

function isClose(a, b, relTol = 1e-9, absTol = 0) {
    const diff = Math.abs(a - b)
    return diff <= Math.max(relTol * Math.abs(a), absTol)
}

async function addPeriod(){
  const name = document.getElementById('namePeriod').value
  const initial = document.getElementById('initialPeriod').value
  const final = document.getElementById('finalPeriod').value

  if(name === '' || initial === '' || final === ''){
    notification.value.title = 'Se deben rellenar todos los campos'
    notification.value.description = 'No se han rellenado todos los campos necesarios para agregar el periodo.'
    document.getElementById('notification').style.display = 'block'
    return
  }

  const daysDifference = Math.floor((new Date(final).getTime() - new Date(initial).getTime()) / (1000 * 60 * 60 * 24))
  const insertPeriod = `insert into main.period(name, initial, final, days, type) values('${name}', '${initial}', '${final}', ${daysDifference}, 'CONS')`
  await DB.execute(insertPeriod)

  notification.value.title = 'Periodo agregado'
  notification.value.description = `El periodo ${name} ha sido agregado correctamente.`
  document.getElementById('notification').style.display = 'block'
  cleanPeriod()
}

function cleanPeriod(){
  document.getElementById('namePeriod').value = ''
  document.getElementById('initialPeriod').value = ''
  document.getElementById('finalPeriod').value = ''
}

function hideUI(name){
  periodPayments.value = false
  const optionHTML = document.getElementsByClassName('option')

  for(let child of optionHTML){
    if(child.children.length === 1){
      const nameClass = child.classList[1]
      const span = document.createElement('span')

      span.id = `title-${nameClass}`
      span.className = menuUI[nameClass].classes
      span.innerHTML = menuUI[nameClass].description
      child.appendChild(span)
    }

    if(child.children.length > 1){
      const childSpan = child.children[child.children.length - 1]
      if(!childSpan.id.includes(name))
        child.removeChild(childSpan)
    }
  }
}

function conciliateUIConsumpoints(){
    hideUI('conciliate')
    typeUI.value = 'conciliate-consumptions'
}

function filterUIConsumptions(){
    hideUI('filter')
    typeUI.value = 'filter-consumptions'
}

function periodUIConsumptions(){
    hideUI('period')
    typeUI.value = 'period-consumptions'
}

async function exportFileUIConsumptions(){
    hideUI('exportFile')
    typeUI.value = 'exportFile-consumptions'

    const tempPeriods = await getAllPeriods()
    periods.value = tempPeriods
}

async function paymentUIConsumptions(){
    hideUI('payments')
    typeUI.value = 'payments-consumptions'
    await getPayments()
}

function cashUI(){
  hideUI('cash')
  typeUI.value = 'cash'
}

function selectFilter(value){
    const filter = value.target.value

    switch(filter){
        case 'bq':
          typeFilter.value = 'block'
          break
        case 'cd':
          typeFilter.value = 'condominium'
          break
        case 'pr':
          typeFilter.value = 'period'
          break
        default:
          typeFilter.value = ''
          break
    }
}

async function deleteConsumptions(){
  let tempConsumptions = consumptions.value
  const toDeleteConsumptions = tempConsumptions.filter(item => item.checked)

  if(toDeleteConsumptions.length === 0){
    notification.value.title = 'No se han seleccionado consumos'
    notification.value.description = 'No se han seleccionado consumos para eliminar.'
    document.getElementById('notification').style.display = 'block'
    return
  }

  for(let item of toDeleteConsumptions){
    const deleteConsumption = `delete from main.consumption where consumption_id = $1`
    await DB.execute(deleteConsumption, [item.consumption_id])

    const deleteReading = `delete from main.reading where reading_id = $1`
    await DB.execute(deleteReading, [item.reading_id])
  }

  await getGeneralConsumptions()

  notification.value.title = 'Eliminación exitosa'
  notification.value.description = 'Se han eliminado los consumos seleccionados.'
  document.getElementById('notification').style.display = 'block'
}

async function getLastPeriod(){
  const selectLastPeriod = 'select period_id, name from main.period order by period_id desc limit 1'
  const resultPeriod = await DB.select(selectLastPeriod)
  const tempPeriod = resultPeriod.shift()

  return tempPeriod
}

async function getPeriodById(period_id){
  const selectPeriodById = `select period_id, name from main.period where period_id = ${period_id}`
  const resultPeriod = await DB.select(selectPeriodById)
  const tempPeriod = resultPeriod.shift()

  return tempPeriod
}

async function getGeneralConsumptions(){
  const temp_consumptions_count = await DB.select(queryConsumptionsCount, [period.value.period_id])
  consumptions_count.value = temp_consumptions_count.shift().consumptions_count
  const selectConsumptions = `${queryConsumptions} limit ${salt_consumptions.value}`
  const tempConsumptions = await DB.select(selectConsumptions, [period.value.period_id])

  for (let item of tempConsumptions){
    item.checked = false
    const total = await DB.select(structuredQueries.total.queryPeriod, [item.client_id, period.value.period_id, period.value.period_id])
    if(total.length > 0)
      item.total_payment = total.shift().total.toFixed(2)
    else
      item.total_payment = 0
  }

  consumptions.value = tempConsumptions
}

async function checkTolerance(event){
  const str = event.target.value // description (string: 8-11), amount (d, d.d), tolerance (d, d%), amount:tolerance (d:d, d:d%)
  const amountRegex = /^-?\d+(\.\d+)?:$/
  const toleranceRegex = /^:-?\d+(\.\d+)?%?$/
  const amountToleranceRegex = /^-?\d+(\.\d+)?%?:-?\d+(\.\d+)?%?$/

  if(amountToleranceRegex.test(str) || toleranceRegex.test(str) || amountRegex.test(str)){
    const tempPayments = await DB.select(structuredQueries.payments.queryNotAssigned)
    payments.value = tempPayments
  }

  if(amountToleranceRegex.test(str)){
    const [amount, tolerance] = str.split(':')
    let tempPayments = payments.value
    if(tolerance.includes('%')){
      const percent = parseFloat(tolerance.replaceAll('%', ''))
      tempPayments = tempPayments.filter(item => isClose(parseFloat(amount), item.amount, percent / 100.0, 0))
      payments.value = tempPayments
    }else{
      tempPayments = tempPayments.filter(item => isClose(parseFloat(amount), item.amount, 0, tolerance))
      payments.value = tempPayments
    }
  }else if(toleranceRegex.test(str)){
    const tolerance = str.replaceAll(':', '')
    if(tolerance.includes('%')){
      let tempPayments = payments.value
      const percent = parseFloat(tolerance.replaceAll('%', ''))
      tempPayments = tempPayments.filter(item => isClose(client.value.total, item.amount, percent / 100.0, 0))
      payments.value = tempPayments
    }else{
      let tempPayments = payments.value
      tempPayments = tempPayments.filter(item => isClose(client.value.total, item.amount, 0, tolerance))
      payments.value = tempPayments
    }
  }else if(amountRegex.test(str)){
    const [amount] = str.split(':')
    let tempPayments = payments.value
    tempPayments = tempPayments.filter(item => isClose(amount, item.amount))
    payments.value = tempPayments
  }
}

async function getPayments(event){
  let query = structuredQueries.payments.queryNotAssigned
  if(event){
    switch(event.target.value){
      case 'ag':
        query = structuredQueries.payments.queryAssigned
        const references = []
        let tempPayments = []
        consumptions.value.forEach(consumption => references.push({ reference: consumption.reference, client: consumption.department }))
        for(let item of references){
          const payment = await DB.select(query, [item.reference])
          payment.forEach(payment => payment.client = item.client)
          tempPayments = tempPayments.concat(payment)
        }

        payments.value = tempPayments
        return
      case 'na':
        query = structuredQueries.payments.queryNotAssigned
        break
      case 'cl':
        payments.value = []
        const clients = consumptions.value.filter(item => item.checked)
        let tempPaymentsByClient = []
        if (clients.length > 0) {
          for(let client of clients){
            const payment = await DB.select(structuredQueries.payments.queryByClient, [client.client_id])
            payment.forEach(payment => payment.client = client.department)
            tempPaymentsByClient = tempPaymentsByClient.concat(payment)
          }
          payments.value = tempPaymentsByClient
        }
        return
    }
  }

  const tempPayments = await DB.select(query)
  payments.value = tempPayments
}

async function addPayment(){
  const description = document.getElementById('paymentDescription').value
  const amount = document.getElementById('paymentAmount').value
  const date = document.getElementById('paymentDate').value

  const notif = {
    title: 'No se puede asignar el pago',
    description: 'No se ha seleccionado algún cliente ó no existe información suficiente para asignar el pago.'
  }

  if(client.value.client_id === undefined || description === '' || amount === '' || date === ''){
    notification.value = notif
    document.getElementById('notification').style.display = 'block'
    return
  }

  const insertPayment = `insert into main.payment (account_id, description, amount, done_at, validated, to_download, downloaded, type_identificacion, reference) values ($1, $2, $3, '${date}', false, null, null, 'ch', '00000000-9:9')`
  await DB.execute(insertPayment, [client.value.account_id, description, parseFloat(amount)])

  await getGeneralConsumptions()
  const tempPayments = await DB.select(structuredQueries.payments.queryNotAssigned)
  payments.value = tempPayments
  hideUI('conciliate')
  typeUI.value = 'conciliate-consumptions'

  document.getElementById('paymentDescription').value = ''
  document.getElementById('paymentAmount').value = ''
  document.getElementById('paymentDate').value = ''

  
  notif.title = 'Registro exitoso',
  notif.description = 'El registro del pago en efectivo se ha realizado con éxito.'

  notification.value = notif
  document.getElementById('notification').style.display = 'block'
}

function hideNotification(name){
  const notification = document.getElementById(name)
  notification.style.display = 'none'
}

async function filter(){
  let toFilter = ''
  let values = []

  queryParams.forEach(item => {
    toFilter = `${toFilter}-${item.filter}`
  })

  if(toFilter.includes('block') && toFilter.includes('condominium') && toFilter.includes('period')){
    queryConsumptions = structuredQueries.blockAndCondominiumAndPeriod.query
    queryConsumptionsCount = structuredQueries.blockAndCondominiumAndPeriod.count

    queryParams.forEach(item => {
      if (item.filter === 'block')
        values.push(parseInt(item.value))
    })

    queryParams.forEach(async item => {
      if (item.filter === 'period'){
        values.push(parseInt(item.value))
        period.value = await getPeriodById(parseInt(item.value))
      }
    })

    queryParams.forEach(item => {
      if (item.filter === 'condominium')
        values.push(parseInt(item.value))
    })

  }else if(toFilter.includes('block') && toFilter.includes('condominium')){
    queryConsumptions = structuredQueries.blockAndCondominium.query
    queryConsumptionsCount = structuredQueries.blockAndCondominium.count

    queryParams.forEach(item => {
      if (item.filter === 'block')
        values.push(parseInt(item.value))
    })

    queryParams.forEach(item => {
      if (item.filter === 'condominium')
        values.push(parseInt(item.value))
    })
  }else if(toFilter.includes('block') && toFilter.includes('period')){
    queryConsumptions = structuredQueries.blockAndPeriod.query
    queryConsumptionsCount = structuredQueries.blockAndPeriod.count

    queryParams.forEach(item => {
      if (item.filter === 'block')
        values.push(parseInt(item.value))
    })

    queryParams.forEach(async item => {
      if (item.filter === 'period'){
        values.push(parseInt(item.value))
        period.value = await getPeriodById(parseInt(item.value))
      }
    })
  }else if(toFilter.includes('block')){
    queryConsumptions = structuredQueries.block.query
    queryConsumptionsCount = structuredQueries.block.count

    queryParams.forEach(item => {
      if (item.filter === 'block')
        values.push(parseInt(item.value))
    })
  }

  const temp_consumptions_count = await DB.select(queryConsumptionsCount, values)
  consumptions_count.value = temp_consumptions_count.shift().consumptions_count
  const selectConsumptions = `${queryConsumptions} limit ${salt_consumptions.value}`
  const tempConsumptions = await DB.select(selectConsumptions, values)

  for (let item of tempConsumptions){
    item.checked = false
    const total = await DB.select(structuredQueries.total.queryPeriod, [item.client_id, period.value.period_id, period.value.period_id])
    if(total.length > 0)
      item.total_payment = total.shift().total.toFixed(2)
    else
      item.total_payment = 0
  }

  consumptions.value = tempConsumptions

  filterValues = values
}

async function addQueryParam(event){
  const param = event.target.value.split('-')
  const [filter, value] = param

  queryParams = queryParams.filter(item => item.filter !== filter)
  queryParams.push({ filter, value })

  if(filter === 'block'){
    const tempCondominiums = await getCondominiumsPerBlock(value)
    filterPills.value['condominium'].options = tempCondominiums
  }
}

function addFilter(){
  let tempFilters = []
  let tempIDs = []
  filters.value.forEach(item => {
    tempIDs.push(item.id)
  })

  filters.value = []
  tempIDs.push(typeFilter.value)
  const uniqueIDs = new Set(tempIDs)
  tempIDs = [...uniqueIDs]

  tempIDs.forEach((item) => {
    if(item === '') return

    tempFilters.push(filterPills.value[item])
  })
  filters.value = tempFilters
}

async function removeFilter(id){
  let tempFilters = filters.value
  tempFilters = tempFilters.filter(item => item.id !== id)
  const tempQueryParams = queryParams.filter(item => item.filter !== id)
  filters.value = tempFilters
  queryParams = tempQueryParams

  await filter()
}

async function removeFilters(){
  filters.value = []
  period.value = await getLastPeriod()

  queryParams = []
  filterValues = []

  queryConsumptionsCount = structuredQueries.general.count
  queryConsumptions = structuredQueries.general.query
  filterValues = [period.value.period_id]

  const temp_consumptions_count = await DB.select(queryConsumptionsCount, filterValues)
  consumptions_count.value = temp_consumptions_count.shift().consumptions_count
  const selectConsumptions = `${queryConsumptions} limit ${salt_consumptions.value}`
  const tempConsumptions = await DB.select(selectConsumptions, filterValues)

  for (let item of tempConsumptions){
    item.checked = false
    const total = await DB.select(structuredQueries.total.queryPeriod, [item.client_id, period.value.period_id, period.value.period_id])
    if(total.length > 0)
      item.total_payment = total.shift().total.toFixed(2)
    else
      item.total_payment = 0
  }

  consumptions.value = tempConsumptions
}

function checkAllConsumptions(value){
  const tempConsumptions = consumptions.value

  for(let item of tempConsumptions){
    item.checked = value.target.checked
  }

  consumptions.value = []
  consumptions.value = tempConsumptions
}

function checkConsumption(consumption){
  consumption.checked = !consumption.checked
}

async function selectFile(){
  const selectedFile = await open({
    title: 'Selecciona tu archivo',
    multiple: false,
    directory: false,
    filters: [ { name: "Archivo de pagos", extensions: ["xlsx"] } ]
  })

  if(selectedFile !== ''){
    exportFilePath.value = selectedFile
    exportFileName.value = selectedFile.split('/').pop()
  }
}
 // { client_id, total, reference, identifier }
async function exportFile(){
  const tempConsumptions = consumptions.value
  const toDownloadConsumptions = []

  const toDownloadFile = await readFile(exportFilePath.value)
  const workbook = read(toDownloadFile)

  const linker  = downloadConsumptions(workbook, linker_consumptions)

  for(let item of tempConsumptions){
    const tempClient = {
      client_id: item.client_id,
      total: parseFloat(item.total_payment),
      reference: item.reference,
      identifier: item.identifier
    }
    toDownloadConsumptions.push(tempClient)
  }

  const response = await invoke('export_consumptions', { path: exportFilePath.value, data: toDownloadConsumptions, linker: JSON.stringify(linker) })
}

async function assignPayment(payment_id){
  await DB.execute(structuredQueries.payments.queryAssignPayment, [client.value.account_id, payment_id])
  const tempPayments = await DB.select(structuredQueries.payments.queryNotAssigned)
  payments.value = tempPayments
  await getGeneralConsumptions()
}

async function deletePayment(payment_id){
  await DB.execute(structuredQueries.payments.queryDeletePayment, [payment_id])
  const tempPayments = await DB.select(structuredQueries.payments.queryNotAssigned)
  payments.value = tempPayments
  await getGeneralConsumptions()
}

async function removePayment(payment_id){
  const deletePayment = `delete from main.payment where payment_id = $1`
  await DB.execute(deletePayment, [payment_id])

  await getGeneralConsumptions()
  const tempPayments = await DB.select(structuredQueries.payments.queryNotAssigned)
  payments.value = tempPayments
  hideUI('conciliate')
  typeUI.value = 'conciliate-consumptions'
}

async function getPeriodPayments(value){
  const tempConsumptions = consumptions.value
  let tempPayments = []

  if(!isNaN(value.target.value))
    tempPayments = await DB.select(structuredQueries.payments.queryByClientPeriod, [global_client_id.value, parseInt(value.target.value), parseInt(value.target.value)])
  else
    tempPayments = await DB.select(structuredQueries.payments.queryByClient, [global_client_id.value])

  let tempClient = ''

  for(let item of tempConsumptions){
    if(item.client_id === global_client_id.value)
      tempClient = item.department
  }

  tempPayments.forEach(payment => { payment.client = tempClient })
  payments.value = tempPayments
}

async function showDetails(client_id){
  if(typeUI.value === 'payments-consumptions'){
    const tempConsumptions = consumptions.value
    const payment = await DB.select(structuredQueries.payments.queryByClient, [client_id])
    let tempClient = ''

    for(let item of tempConsumptions){
      if(item.client_id === client_id)
        tempClient = item.department
    }

    periods.value = await getAllPeriods()
    periodPayments.value = true
    global_client_id.value = client_id

    payment.forEach(payment => { payment.client = tempClient })
    payments.value = payment

    return
  }

  let tempClient = await DB.select(structuredQueries.general.queryClientInformation, [period.value.period_id, client_id])

  if(tempClient.length > 0){
    tempClient = tempClient.shift()
    const total = await DB.select(structuredQueries.total.queryPeriod, [client_id, period.value.period_id, period.value.period_id])
    if(total.length > 0)
      tempClient.total_payment = total.shift().total.toFixed(2)
    else
      tempClient.total_payment = 0

    client.value = tempClient
  }
  hideUI('conciliate')
  typeUI.value = 'conciliate-consumptions'
  payments.value = await DB.select(structuredQueries.payments.queryNotAssigned)
}

async function getCondominiumsPerBlock(block){
  const selectCondominium = `select cd.condominium_id as id, (cd.name || ' ' || cd.building) as name from main.condominium cd where cd.block = ${block}`
  const tempCondominium = await DB.select(selectCondominium)

  return tempCondominium
}

async function getAllPeriods(){
  const selectPeriods = `select pr.period_id as id, pr.name as name from main.period pr`
  const tempPeriods = await DB.select(selectPeriods)

  return tempPeriods
}

async function showPerPageConsumptions(value){
  if(filterValues.length === 0)
    filterValues = [period.value.period_id]

  let selectConsumptions = ''

  if(isNaN(value.target.value))
    selectConsumptions = queryConsumptions
  else{
    salt_consumptions.value = parseInt(value.target.value)
    selectConsumptions = `${queryConsumptions} limit ${salt_consumptions.value}`
  }

  const temp_consumptions_count = await DB.select(queryConsumptionsCount, filterValues)
  consumptions_count.value = temp_consumptions_count.shift().consumptions_count
  const tempConsumptions = await DB.select(selectConsumptions, filterValues)

  for (let item of tempConsumptions){
    item.checked = false
    const total = await DB.select(structuredQueries.total.queryPeriod, [item.client_id, period.value.period_id, period.value.period_id])
    if(total.length > 0)
      item.total_payment = total.shift().total.toFixed(2)
    else
      item.total_payment = 0
  }

  consumptions.value = tempConsumptions
}

async function getPreviousConsumptions(){
  if(filterValues.length === 0)
    filterValues = [period.value.period_id]

  const offset = (current_consumptions.value - salt_consumptions.value) > -1 ? current_consumptions.value - salt_consumptions.value : 0
  const temp_consumptions_count = await DB.select(queryConsumptionsCount, filterValues)
  consumptions_count.value = temp_consumptions_count.shift().consumptions_count
  const selectConsumptions = `${queryConsumptions} limit ${salt_consumptions.value} offset ${offset}`
  const tempConsumptions = await DB.select(selectConsumptions, filterValues)

  for (let item of tempConsumptions){
    item.checked = false
    const total = await DB.select(structuredQueries.total.queryPeriod, [item.client_id, period.value.period_id, period.value.period_id])
    if(total.length > 0)
      item.total_payment = total.shift().total.toFixed(2)
    else
      item.total_payment = 0
  }

  consumptions.value = tempConsumptions
  current_consumptions.value = offset
}

async function getNextConsumptions(){
  if(filterValues.length === 0)
    filterValues = [period.value.period_id]

  const offset = current_consumptions.value + salt_consumptions.value < consumptions_count.value ? current_consumptions.value + salt_consumptions.value : consumptions_count.value
  const temp_consumptions_count = await DB.select(queryConsumptionsCount, filterValues)
  consumptions_count.value = temp_consumptions_count.shift().consumptions_count
  const selectConsumptions = `${queryConsumptions} limit ${salt_consumptions.value} offset ${offset}`
  const tempConsumptions = await DB.select(selectConsumptions, filterValues)

  for (let item of tempConsumptions){
    item.checked = false
    const total = await DB.select(structuredQueries.total.queryPeriod, [item.client_id, period.value.period_id, period.value.period_id])
    if(total.length > 0)
      item.total_payment = total.shift().total.toFixed(2)
    else
      item.total_payment = 0
  }

  consumptions.value = tempConsumptions
  current_consumptions.value = offset
}
</script>
<template>
  <!-- CONSUMOS -->
  <div id="consumptions" class="flex mr-6 min-w-[800px] min-h-[600px]">
    <div id="notification" style="display: none;" class="fixed mb-4 top-4 right-4 w-96 bg-white border rounded-xl flex-col z-50">
      <div class="mt-2 ml-4 flex justify-between">
        <h1 class="text-md font-bold">{{ notification.title }}</h1>
        <button class="rounded-full border p-1 hover:bg-slate-200 hover:opacity-80 mr-4" @click="hideNotification('notification')">
          <svg class="w-5 h-5 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M6 18 17.94 6M18 18 6.06 6"/>
          </svg>        
        </button>
      </div>
      <div class="mt-2 ml-4 mb-4">
        <p class="text-sm font-light">{{ notification.description }}</p>
      </div>
    </div>

    <div class="sm:max-w-[80vw] sm:w-[80vw] border max-h-screen mt-4 mx-4 shadow-md">
      <div class="py-2 mx-4 flex justify-between overflow-scroll">
        <h3 class="text-md font-bold mr-2">Todos los consumos</h3>
        <div class="flex gap-4 items-center">
          <div id="conciliate">
            <button @click="conciliateUIConsumpoints" class="option conciliate flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M5 18h14M5 18v3h14v-3M5 18l1-9h12l1 9M16 6v3m-4-3v3m-2-6h8v3h-8V3Zm-1 9h.01v.01H9V12Zm3 0h.01v.01H12V12Zm3 0h.01v.01H15V12Zm-6 3h.01v.01H9V15Zm3 0h.01v.01H12V15Zm3 0h.01v.01H15V15Z"/>
              </svg>
              <span id="title-conciliate" class="title text-md font-light ml-2">Conciliar</span>          
            </button>
          </div>
          <div id="filter">
            <button @click="filterUIConsumptions" class="option filter flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-width="1" d="M18.796 4H5.204a1 1 0 0 0-.753 1.659l5.302 6.058a1 1 0 0 1 .247.659v4.874a.5.5 0 0 0 .2.4l3 2.25a.5.5 0 0 0 .8-.4v-7.124a1 1 0 0 1 .247-.659l5.302-6.059c.566-.646.106-1.658-.753-1.658Z"/>
              </svg>
              <span id="title-filter" class="title text-md font-light ml-2">Filtrar</span>          
            </button>
          </div>
          <div id="period">
            <button @click="periodUIConsumptions" class="option period flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
              </svg>              
              <span id="title-period" class="title text-md font-light ml-2">Periodos</span>          
            </button>
          </div>
          <div id="payments">
            <button @click="paymentUIConsumptions" class="option payments flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-width="1" d="M8 7V6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-1M3 18v-7a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm8-3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>
              </svg>              
              <span id="title-payments" class="title text-md font-light ml-2">Pagos</span>
            </button>
          </div>
          <div id="cashUI">
            <button @click="cashUI" class="option cash flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6.03v13m0-13c-2.819-.831-4.715-1.076-8.029-1.023A.99.99 0 0 0 3 6v11c0 .563.466 1.014 1.03 1.007 3.122-.043 5.018.212 7.97 1.023m0-13c2.819-.831 4.715-1.076 8.029-1.023A.99.99 0 0 1 21 6v11c0 .563-.466 1.014-1.03 1.007-3.122-.043-5.018.212-7.97 1.023"/>
              </svg>                                                   
              <span id="title-cash" class="title text-md font-light ml-2">Efectivo</span>  
            </button>
          </div>
          <div id="export">
            <button @click="exportFileUIConsumptions" class="option exportFile flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 10V4a1 1 0 0 0-1-1H9.914a1 1 0 0 0-.707.293L5.293 7.207A1 1 0 0 0 5 7.914V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2M10 3v4a1 1 0 0 1-1 1H5m5 6h9m0 0-2-2m2 2-2 2"/>
              </svg>
              <span id="title-exportFile" class="title text-md font-light ml-2">Exportar</span>          
            </button>
          </div>
        </div>
      </div>
      <div class="flex flex-col overflow-x-auto overflow-y-auto max-h-[72vh] h-[72vh] inline-block align-middle overflow-hidden">
        <table class="sm:rounded-lg divide-y">
          <thead class="bg-gray-100">
            <tr>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">
                <input id="checkConsumptions" type="checkbox" @change="checkAllConsumptions" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2">
              </th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">ID cliente</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cliente</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Clave referenciada</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Monto de consumo</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Detalles</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Monto pagado</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr class="odd:bg-white even:bg-gray-100" v-for="consumption in consumptions">
              <td class="pl-4 whitespace-nowrap">
                <input type="checkbox" :checked="consumption.checked" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" @click="checkConsumption(consumption)">
              </td>
              <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">{{ consumption.identifier }}</td>
              <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ consumption.department }}</td>
              <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ consumption.reference }}</td>
              <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">$ {{ consumption.total }}</td>
              <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">
                <button class="rounded-full border p-1 hover:bg-slate-200 hover:opacity-80" @click="showDetails(consumption.client_id)">
                  <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-width="1" d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z"/>
                    <path stroke="currentColor" stroke-width="1" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                  </svg>                  
                </button>
              </td>
              <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">$ {{ consumption.total_payment }}</td>
            </tr>                 
          </tbody>
        </table>
      </div>
      <div class="m-4 relative flex justify-center items-center gap-2 b-2">
        <div>
          <select id="perPage" @change="showPerPageConsumptions" class="w-full bg-transparent text-sm placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-lg pl-2 pr-1 py-1 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
            <option selected value="10">10 por página</option> 
            <option value="50">50 por página</option> 
            <option value="75">75 por página</option> 
            <option value="100">100 por página</option>
            <option value="all">Todos</option> 
          </select>
        </div>
        <div class="flex justify-center items-center gap-2">
          <div @click="getPreviousConsumptions" class="hover:cursor-pointer hover:bg-gray-200 rounded py-1">
            <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7"/>
            </svg> 
          </div>
          <p class="font-normal text-black">{{ current_consumptions }} de {{ consumptions_count }} </p>   
          <div @click="getNextConsumptions" class="hover:cursor-pointer hover:bg-gray-200 rounded py-1">
            <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/>
            </svg>  
          </div>
        </div>          
      </div>
    </div>
  
    <div class="w-[20vw] h-[87vh] relative right-0 shadow-md border mt-4">
      <div id="conci" v-if="typeUI === 'conciliate-consumptions'">
        <div class="relative w-[calc(100%-1rem)] ml-2">
          <div class="ml-1 mt-2 border-b border-gray-600 pb-2 flex justify-between items-center">
            <h3 class="font-bold">Conciliación</h3>
            <button class="w-6 h-6 mt-1 mr-2" @click="deleteConsumptions">
              <svg class="w-6 h-6 text-gray-600 hover:cursor-pointer hover:text-red-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"/>
              </svg>                       
            </button>
          </div>
          <input id="tolerance" type="text" @keyup="checkTolerance" class="border mt-2 text-xs rounded-md block w-full px-2 py-2 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce referencia ó la cifra de tolerancia (% ó $)">
        </div>
        <div class="p-2 overflow-y-auto">
          <div class="border rounded-lg p-2 mb-2 shadow-md" v-if="client">
            <header class="border-b border-gray-600 pb-2">
              <h3 class="text-sm font-semibold">ID Cliente: <span class="text-slate-500 font-normal">{{ client.identifier }}</span></h3>
              <p class="text-[11px] text-slate-600 font-semibold">{{ client.department }}</p>
            </header>
            <section class="flex-col space-y-1">
              <p class="text-xs mt-2 font-semibold">Clave referenciada: <span class="text-slate-600 font-light">{{ client.reference }}</span></p>
              <p class="text-xs font-semibold">Consumo en litros: <span class="text-sm text-slate-600 font-light">{{ client.liters }} Lts.</span></p>
              <p class="text-xs font-semibold">Adeudo: <span class="text-sm text-slate-600 font-light">$ {{ client.debt }}</span></p>
              <p class="text-xs font-semibold">Monto de consumo: <span class="text-sm text-slate-600 font-light">$ {{ client.total }}</span></p>
              <p class="text-xs font-semibold">Monto de pagado: <span class="text-sm text-slate-600 font-light">$ {{ client.total_payment }}</span></p>
            </section>
          </div>
        </div>
        <div class="relative w-[calc(100%-1rem)] ml-2 mt-2">
          <h3 class="ml-1 border-b border-gray-600 pb-2 font-bold">Pagos</h3>
          <div class="overflow-y-auto h-[45vh]">
            <div class="border rounded-lg p-2 mb-2 mt-2 shadow-md" v-for="payment in payments">
              <header class="border-b border-gray-600 pb-2 flex justify-between items-center">
                <h3 class="text-md font-bold">Pago: <span class="text-slate-500 font-normal">{{ payment.payment_id }}</span></h3>
              </header>
              <section class="flex-col space-y-1 mb-2">
                <p class="text-xs mt-2 font-semibold">Descripción del pago: <span class="text-slate-600 font-light">{{ payment.description }}</span></p>
                <p class="text-xs font-semibold">Fecha del pago: <span class="text-sm text-slate-600 font-light">{{ payment.done_at }}</span></p>
                <p class="text-xs font-semibold">Monto del pago: <span class="text-sm text-slate-600 font-light">$ {{ payment.amount.toLocaleString() }}</span></p>
                <p class="text-xs font-semibold" v-if="payment.type_identificacion">Emparejado por: 
                  <span v-if="payment.type_identificacion === 'rf'" class="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-green-100">Referencia</span>
                  <span v-else-if="payment.type_identificacion === 'am'" class="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-blue-100">Monto</span>
                  <span v-else-if="payment.type_identificacion === 'ch'" class="bg-purpple-100 text-purpple-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-purpple-100">Efectivo</span>
                </p>
                <p class="text-xs font-semibold" v-if="payment.client">Cliente: <span class="text-sm text-slate-600 font-light">{{ payment.client }}</span></p>
              </section>
              <div class="flex justify-around gap-2 mb-2 border-t border-gray-600">
                <button class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="assignPayment(payment.payment_id)">Asignar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="filt" class="mx-2" v-else-if="typeUI === 'filter-consumptions'">
        <h3 class="ml-2 mt-2 mb-2 font-bold">Filtros aplicados</h3>
        <div class="flex overflow-x-auto mr-2 mb-3">
          <div :class="pill.classes" v-for="pill in filters">
            <h6 class="pl-1">{{ pill.name }}</h6>
            <button @click="removeFilter(pill.id)">
              <svg class="w-3 h-3 text-slate-600" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18 17.94 6M18 18 6.06 6"/>
              </svg>
            </button> 
          </div>        
        </div>

        <hr class="mt-2">

        <h3 class="mt-2 font-bold">Filtrar por</h3>
        <div class="flex gap-2 justify-between items-center">
          <div class="relative w-[calc(100%)] mt-2">
            <select id="type_filter" @change="selectFilter" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
              <option selected>Selecione un filtro</option> 
              <option value="bq">Bloque</option>
              <option value="cd">Condominio</option>
              <option value="pr">Periodo</option>
            </select>
            <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
            </svg>              
          </div>
          <button class="w-6 h-6 mt-1" @click="addFilter">
            <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M5 12h14m-7 7V5"/>
            </svg>            
          </button>
        </div>
        <h3 class="mt-2 font-bold">Filtros</h3>
        <div class="relative w-[calc(100%)] mt-2" v-for="filter in filters">
            <select @change="addQueryParam" id="block_filter" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
              <option value="block-0" selected>{{ filter.description }}</option> 
              <option :value="`${filter.id}-${option.id}`" v-for="option in filter.options">
                {{ option.name }}
              </option>
            </select>
            <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
            </svg>              
        </div>
        <button @click="filter" class="w-full mt-2 mr-4 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-red-600 p-2">Filtrar</button>
        <button @click="removeFilters" class="w-full mt-2 mr-4 text-white bg-red-700 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-red-600 p-2">Eliminar filtros</button>
      </div>

      <div id="exp" v-else-if="typeUI === 'exportFile-consumptions'">
        <h3 class="ml-2 mt-2 font-bold">Exportar</h3>
        <div class="w-[calc(94%)] mt-2 ml-2 mb-2">
          <input id="filePath" type="text" :value="exportFileName" disabled class="border rounded-md text-sm text-slate-400 w-full p-1 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Seleccionar archivo">
          <div class="flex gap-2">
            <button @click="selectFile" class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Seleccionar</button>
            <button @click="exportFile" class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Exportar</button>
          </div>
        </div>
      </div>

      <div id="exp" v-else-if="typeUI === 'period-consumptions'">
        <h3 class="ml-2 mt-2 font-bold">Periodos</h3>

        <hr class="mt-2">

        <div class="w-[calc(94%)] mt-2 ml-2 mb-2">
          <input id="namePeriod" type="text" class="border mt-2 rounded-md text-sm text-slate-800 w-full p-1 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce el nombre del periodo">
          <input id="initialPeriod" type="text" class="border mt-2 rounded-md text-sm text-slate-800 w-full p-1 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce la fecha inicial (aaaa-mm-dd)">
          <input id="finalPeriod" type="text" class="border mt-2 rounded-md text-sm text-slate-800 w-full p-1 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce la fecha final (aaaa-mm-dd)">
          <div class="flex gap-2">
            <button @click="addPeriod" class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Agregar</button>
            <button @click="cleanPeriod" class="w-full mt-2 text-white bg-yellow-700 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Limpiar</button>
          </div>
        </div>
      </div>

      <div id="pays" v-else-if="typeUI === 'cash'">
        <h3 class="ml-2 mt-2 font-bold">Efectivo</h3>
        <hr class="my-2">
        <div class="border w-[calc(100%-1rem)] rounded-lg ml-2 p-2 mb-2 shadow-md" v-if="client">
          <header class="border-b border-gray-600 pb-2">
            <h3 class="text-sm font-semibold">ID Cliente: <span class="text-slate-500 font-normal">{{ client.identifier }}</span></h3>
            <p class="text-[11px] text-slate-600 font-semibold">{{ client.department }}</p>
          </header>
          <section class="flex-col space-y-1">
            <p class="text-xs mt-2 font-semibold">Clave referenciada: <span class="text-slate-600 font-light">{{ client.reference }}</span></p>
            <p class="text-xs font-semibold">Consumo en litros: <span class="text-sm text-slate-600 font-light">{{ client.liters }} Lts.</span></p>
            <p class="text-xs font-semibold">Adeudo: <span class="text-sm text-slate-600 font-light">$ {{ client.debt }}</span></p>
            <p class="text-xs font-semibold">Monto de consumo: <span class="text-sm text-slate-600 font-light">$ {{ client.total }}</span></p>
            <p class="text-xs font-semibold">Monto de pagado: <span class="text-sm text-slate-600 font-light">$ {{ client.total_payment }}</span></p>
          </section>
        </div>

        <hr>

        <div class="w-[calc(100%-1rem)] mt-2 ml-2">
          <input id="paymentDescription" type="text" class="border mt-2 mb-2 text-xs rounded-md block w-full px-2 py-2 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce la descripción del pago">
          <input id="paymentAmount" type="text" class="border mt-2 mb-2 text-xs rounded-md block w-full px-2 py-2 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce el monto del pago">
          <input id="paymentDate" type="text" class="border mt-2 mb-2 text-xs rounded-md block w-full px-2 py-2 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce la fecha del pago (aaaa-mm-dd)">

          <button class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="addPayment">Agregar</button>
        </div>
      </div>

      <div id="pays" v-else-if="typeUI === 'payments-consumptions'">
        <h3 class="ml-2 mt-2 font-bold">Pagos</h3>
        <div class="relative w-[calc(94%)] mt-2 ml-2 mb-2">
          <select id="type_filter" @change="getPayments" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
            <option selected>Selecione un filtro</option> 
            <option value="ag">Asignados</option>
            <option value="na">No asignados</option>
            <option value="cl">Cliente</option>
          </select>
          <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
          </svg>              
        </div>

        <hr>

        <div class="p-2 overflow-y-auto h-[74vh]">
          <div class="relative w-[calc(98%)] mt-2 mb-2" v-if="periodPayments">
            <select id="period_to_show" @change="getPeriodPayments" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
              <option selected>Selecione un periodo</option> 
              <option :value="`${period.id}`" v-for="period in periods">
                {{ period.name }}
              </option>
            </select>
            <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
            </svg>              
          </div>
          <div class="border rounded-lg p-2 mb-2 shadow-md" v-for="payment in payments">
            <header class="border-b border-gray-600 pb-2 flex justify-between items-center">
              <h3 class="text-md font-bold">Pago: <span class="text-slate-500 font-normal">{{ payment.payment_id }}</span></h3>
            </header>
            <section class="flex-col space-y-1 mb-2">
              <p class="text-xs mt-2 font-semibold">Descripción del pago: <span class="text-slate-600 font-light">{{ payment.description }}</span></p>
              <p class="text-xs font-semibold">Fecha del pago: <span class="text-sm text-slate-600 font-light">{{ payment.done_at }}</span></p>
              <p class="text-xs font-semibold">Monto del pago: <span class="text-sm text-slate-600 font-light">$ {{ payment.amount.toLocaleString() }}</span></p>
              <p class="text-xs font-semibold" v-if="payment.type_identificacion">Emparejado por: 
                <span v-if="payment.type_identificacion === 'rf'" class="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-green-100">Referencia</span>
                <span v-else-if="payment.type_identificacion === 'am'" class="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-blue-100">Monto</span>
                  <span v-else-if="payment.type_identificacion === 'ch'" class="bg-purpple-100 text-purpple-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-purpple-100">Efectivo</span>
              </p>
              <p class="text-xs font-semibold" v-if="payment.client">Cliente: <span class="text-sm text-slate-600 font-light">{{ payment.client }}</span></p>
            </section>
            <div class="mb-2 border-t border-gray-600">
              <button class="w-full mt-2 text-white bg-yellow-700 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="deletePayment(payment.payment_id)">Quitar asignación</button>
              <button class="w-full mt-2 text-white bg-red-700 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="removePayment(payment.payment_id)">Eliminar pago</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
