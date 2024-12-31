<script setup>
import { ref, onBeforeMount } from 'vue'
import Database from '@tauri-apps/plugin-sql'

import { fetch } from '@tauri-apps/plugin-http'
import { open } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'

import { downloadPayments } from '../services/excel'
import { Command } from '@tauri-apps/plugin-shell'

const type_identification = {
  reference: {
    code: 'rf',
    name: 'Clave referenciada',
    classes: 'bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-green-100'
  },
  amount: {
    code: 'am',
    name: 'Monto',
    classes: 'bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-blue-100'
  },
  cash: {
    code: 'ch',
    name: 'Efectivo',
    classes: 'bg-purpple-100 text-purpple-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-purpple-100'
  },
  not_found: {
    code: 'nf',
    name: 'No identificado',
    classes: 'bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-red-100'
  }
}
const type_validation = {
  valid: {
    code: 'v',
    name: 'Validado',
    classes: 'bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-green-100'
  },
  not_valid: {
    code: 'nv',
    name: 'No validado',
    classes: 'bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-red-100'
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
  consumption: {
    id: 'consumption',
    description: 'Consumos',
    classes: 'title text-md font-light ml-2',
    ui: ''
  },
  paymentClient: {
    id: 'paymentClient',
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
  report: {
    id: 'report',
    description: 'Reportes',
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
const structuredQueries = {
  general: {
    query: `select p.payment_id, p.account_id, p.description, p.done_at, p.amount, p.reference from main.payment p where p.validated = false order by p.payment_id asc`,
    count: `select count(*) as payments_count from main.payment p where p.account_id is null and p.validated = false`,
    period: `select p.payment_id, p.account_id, p.description, p.done_at, p.amount, p.reference from main.payment p where done_at >= (select initial from main.period where period_id = $1) and done_at <= (select final from main.period where period_id = $2) and p.validated = false order by p.payment_id asc`,
    countPeriod: `select count(*) as payments_count from main.payment p where done_at >= (select initial from main.period where period_id = $1) and done_at <= (select final from main.period where period_id = $2) and p.validated = false`
  },
  found: {
    query: `select p.payment_id, p.account_id, p.description, p.done_at, p.amount, p.reference from main.payment p where p.account_id is not null and validated = true order by p.payment_id`,
    count: `select count(*) as payments_count from main.payment p where p.account_id is not null and p.validated = true`,
    period: `select p.payment_id, p.account_id, p.description, p.done_at, p.amount, p.reference from main.payment p where done_at >= (select initial from main.period where period_id = $1) and done_at <= (select final from main.period where period_id = $2) and p.account_id is not null and validated = true order by p.payment_id`,
    countPeriod: `select count(*) as payments_count from main.payment p where done_at >= (select initial from main.period where period_id = $1) and done_at <= (select final from main.period where period_id = $2) and p.account_id is not null and validated = true`
  },
  not_found: {
    query: `select p.payment_id, p.account_id, p.description, p.done_at, p.amount, p.reference from main.payment p where p.account_id is null and validated = false order by p.payment_id`,
    count: `select count(*) as payments_count from main.payment p where p.account_id is null and p.validated = false`,
    period: `select p.payment_id, p.account_id, p.description, p.done_at, p.amount, p.reference from main.payment p where done_at >= (select initial from main.period where period_id = $1) and done_at <= (select final from main.period where period_id = $2) and p.account_id is null and validated = false order by p.payment_id`,
    countPeriod: `select count(*) as payments_count from main.payment p where done_at >= (select initial from main.period where period_id = $1) and done_at <= (select final from main.period where period_id = $2) and p.account_id is null and validated = false`
  },
  downloaded: {
    query: `select p.payment_id, p.account_id, p.description, p.done_at, p.amount, p.reference from main.payment p where p.account_id is not null and downloaded = true order by p.payment_id`,
    count: `select count(*) as payments_count from main.payment p where p.account_id is not null and p.downloaded = true`,
    period: `select p.payment_id, p.account_id, p.description, p.done_at, p.amount, p.reference from main.payment p where done_at >= (select initial from main.period where period_id = $1) and done_at <= (select final from main.period where period_id = $2) and p.account_id is not null and downloaded = true order by p.payment_id`,
    countPeriod: `select count(*) as payments_count from main.payment p where done_at >= (select initial from main.period where period_id = $1) and done_at <= (select final from main.period where period_id = $2) and p.account_id is not null and downloaded = true`
  },
  client: {
    queryClient: `select cl.client_id, cl.client, acc.reference_bbva as reference, acc.account_id from  main.client cl join main.account acc on acc.client_id = cl.client_id where cl.client_id = $1`,
    queryClientInformation: `select cl.client_id, cl.identifier, cl.client, acc.reference_bbva as reference, cn.total, cn.debt, cn.liters, acc.account_id from main.condominium cd join main.client cl on cl.condominium_id = cd.condominium_id join main.account acc on acc.client_id = cl.client_id join main.reading rd on rd.client_id = cl.client_id join main.consumption cn on cn.reading_id = rd.reading_id where rd.period_id = $1 and cl.client_id = $2`,
    queryClientInformationPeriod: ``,
    queryIsSupplier: `select cl.client_id from main.condominium cd join main.client cl on cd.condominium_id = cl.condominium_id where cd.block = 0 and cl.client_id = $1`
  },
  payments: {
    queryNotAssigned: `select py.reference, py.payment_id, py.account_id, py.amount, py.description, py.done_at from main.payment py where py.account_id is null`
  },
  period: {
    query: `select period_id, name from main.period`
  },
  makeByReference: {
    query: `select acc.reference_bbva as reference from main.account acc where $1 ilike '%' || acc.reference_bbva || '%' or $2 ilike '%' || substring(acc.reference_bbva, 4, 11) || '%'`
  }
}
let DB = { }
let salt = 10
const validatePayments = []
const payments = ref([])
const payments_count = ref(0)
const current_pay = ref(0)
const typeUI = ref('') // search, conciliate, filter, exportFile
const type_payment = ref('')
const period_id = ref(0)
const periods = ref([])

const paymentsToAssign = ref([])
const paymentsToShow = ref([])

const count_identifier = ref(0)
const index_identifier = ref(0)
const payment = ref({})
const client = ref({})

const supplies = ref([])

let match_counter = 0
const matchedPayments = ref(0)

let paymentQuery = structuredQueries.general.query
let paymentCountQuery = structuredQueries.general.count

const selectedFilePath = ref('')
const selectedFileName = ref('')

const notification = ref({
  title: '',
  description: ''
})

// Variables de entorno
let PROVEE_TEST = ''
let PATH_FROM_EXPORT = ''
let HOST_FROM_EXPORT = ''
let REPORT_PROD = ''

// metodos select() y execute()
onBeforeMount(async function(){
  // Obtenemos variables de entorno
  PROVEE_TEST = await invoke('get_enviroment_variable', { name: 'PROVEE_TEST' })
  PATH_FROM_EXPORT = await invoke('get_enviroment_variable', { name: 'PATH_FROM_EXPORT' })
  HOST_FROM_EXPORT = await invoke('get_enviroment_variable', { name: 'HOST_FROM_EXPORT' })
  REPORT_PROD = await invoke('get_enviroment_variable', { name: 'REPORT_PROD' })

  DB = await Database.load(PROVEE_TEST) // TODO

  const temp_payments_count = await DB.select(paymentCountQuery)
  payments_count.value = temp_payments_count.shift().payments_count
  const tempPayments = await DB.select(`${paymentQuery} limit ${salt}`)

  const tempPeriods = await DB.select(structuredQueries.period.query)
  periods.value = tempPeriods

  for(let idx = 0; idx < tempPayments.length; idx++){
    tempPayments[idx].checked = false
    tempPayments[idx].id = tempPayments[idx].payment_id
    tempPayments[idx].toshow_reference = tempPayments[idx].reference.split('-').shift()

    if(tempPayments[idx].account_id){
      const selectAccountId = `select reference_bbva from main.account where account_id = $1`
      const resultAccount = await DB.select(selectAccountId, [tempPayments[idx].account_id])
      const reference = resultAccount.shift().reference_bbva

      const selectClientByReference = `select (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.client as cl join main.account as acc on cl.client_id = acc.client_id join main.condominium cd on cd.condominium_id = cl.condominium_id where acc.reference_bbva = $1`
      const resultClient = await DB.select(selectClientByReference, [reference])
      const deparment = resultClient.shift().department

      tempPayments[idx].client = deparment
      tempPayments[idx].total = ''
      tempPayments[idx].client_reference = reference
      tempPayments[idx].identification = type_identification.reference
      tempPayments[idx].type_validation = type_validation.not_valid
    }else{
      tempPayments[idx].client_reference = ''
      tempPayments[idx].client = ''
      tempPayments[idx].total = ''
      tempPayments[idx].identification = type_identification.not_found
      tempPayments[idx].type_validation = type_validation.not_valid
    }
  }

  payments.value = tempPayments
})

async function selectFile(){
  const selectedFile = await open({
    title: 'Selecciona tu archivo',
    multiple: false,
    directory: false,
    filters: [ { name: "Archivo de pagos", extensions: ["xlsx"] } ]
  })

  if(selectedFile !== ''){
    selectedFilePath.value = selectedFile
    selectedFileName.value = selectedFile.split('/').pop()
  }
}

async function exportFile(){
  await Command.create('pm2', ['start', '/Users/fmontoya/Gasu/Descarga/src/main.js']).execute()

  await downloadPayments(payments.value, DB)
  await writeTextFile(PATH_FROM_EXPORT, JSON.stringify({ path: `${selectedFilePath.value}`, period_id: period_id.value })) // TODO
  await fetch(HOST_FROM_EXPORT, { method: 'GET' }) // TODO

  notification.value.title = 'Exportación completa'
  notification.value.description = 'Se ha completado la exportación de los pagos.'

  const notificationUI = document.getElementById('notification')
  notificationUI.style.display = 'block'
}

async function start(){
  const selectMethod = document.getElementById('method')
  const selectedIndex = selectMethod.selectedIndex
  const method = selectMethod.options[selectedIndex].value

  switch(method){
    case 'cr':
      await makeByReference()
    break
  }

  const notif = {
    title: 'Conciliación exitosa',
    description: 'Se ha completado la conciliación de la totalidad de los pagos mostrados.'
  }
  notification.value = notif
  document.getElementById('notification').style.display = 'block'
}

async function makeByReference(){
  match_counter = 0
  let temp_payments = payments.value
  matchedPayments.value = 0
  const match = []
  let acc_count = 0

  count_identifier.value = temp_payments.length
  index_identifier.value = 0

  for(let item of temp_payments){
    const description = new String(item.description).replaceAll(' ', '').toLowerCase()
    const account = await DB.select(structuredQueries.makeByReference.query, [description, description])
    if(account.length > 0){
      match.push({ reference_payment: item.reference, description: item.description, reference: account.shift().reference })
      match_counter++
      index_identifier.value++
    }

    matchedPayments.value++
    acc_count = 0
  }

  // ** Revisar duplicados en DB y registros bloque 4 **
  const newMatch = makeUniqueMatch(match)
  const matchClients = await makeMatchClient(newMatch)

  temp_payments = payments.value

  temp_payments.forEach(item => {
    const reference_payment = item.reference
    const matchResult = newMatch.find((anOtherItem) => anOtherItem.reference_payment === reference_payment)
    if(matchResult)
      item.client_reference = matchResult.reference
  })

  // Colocamos cliente
  temp_payments.forEach(item => {
    const client_reference = item.client_reference
    const matchResult = matchClients.find((anOtherItem) => anOtherItem.reference === client_reference)
    if(matchResult){
      item.client = matchResult.department
      item.identification = type_identification.reference
    }

  })

  // Colocamos consumos
  temp_payments.forEach(async function(item) {
    const client_reference = item.client_reference

    if(client_reference !== ''){
      const selectConsumption = `select ac.reference_bbva as reference, cs.liters, cs.total from main.consumption cs join main.reading rd on rd.reading_id = cs.reading_id join main.client cl on cl.client_id = rd.client_id join main.account ac on ac.client_id = cl.client_id where ac.reference_bbva = $1`
      const resultConsumption = await DB.select(selectConsumption, [client_reference])

      if(resultConsumption.length > 0){
        const consumption = resultConsumption.shift()
        item.liters = consumption.liters
        item.total = consumption.total
      }
    }
  })

  payments.value = []
  payments.value = temp_payments
}

function makeUniqueMatch(match){
  const paymentsSet = new Set()
  const newMatch = []

  match.forEach(item => {
    paymentsSet.add(item.reference_payment)
  })

  match.forEach(item => {
    if(paymentsSet.has(item.reference_payment)){
      newMatch.push(item)
      paymentsSet.delete(item.reference_payment)
    }
  })

  return newMatch
}

function checkPayment(payment){
  payment.checked = !payment.checked
}

function checkAllPayments(){
  const checkAll = document.getElementById('checkPayments')
  const temp = payments.value

  for(let item of temp){
    item.checked = checkAll.checked
  }

  payments.value = []
  payments.value = temp
}

function conciliate(){
  hideUI('conciliate')
  typeUI.value = 'conciliate'

}

async function filter(){
  const selectFilter = document.getElementById('type_filter')
  const selectedIndex = selectFilter.selectedIndex
  const type = selectFilter.options[selectedIndex].value

  const selectPeriod = document.getElementById('period_filter')
  const selectedPeriodIndex = selectPeriod.selectedIndex
  const period = selectPeriod.options[selectedPeriodIndex].value

  period_id.value = !isNaN(period) ? parseInt(period) : 0

  switch(type) {
    case 'fn':
      await getAllValidatedPayments(period)

    break
    case 'n_fn':
      await getAllUnvalidatedPayments(period)

    break
    case 'dw':
      await getAllDownloadedPayments(period)

    break
    default:
      await getAllPayments(period)

    break
  }
}

async function deleteFilter(){
  period_id.value = 0

  await getAllPayments(period_id.value)
}

function filterUI(){
  hideUI('filter')
  typeUI.value = 'filter'
}

function consumptionUI(){
  hideUI('consumption')
  typeUI.value = 'consumption'
}

async function paymentsClientUI(){
  hideUI('paymentClient')
  typeUI.value = 'paymentClient'

  if(client.value.client_id === undefined)
    return

  const selectPaymentsFromClient = `select py.payment_id, py.description, py.done_at, py.amount, acc.client_id, acc.reference_bbva as reference from main.payment as py join main.account acc on py.account_id = acc.account_id where acc.client_id = $1`
  const tempPayments = await DB.select(selectPaymentsFromClient, [client.value.client_id])
  paymentsToShow.value = tempPayments
}

async function reportUI(){
  hideUI('report')
  typeUI.value = 'report'

  const selectPeriods = `select pr.period_id, pr.name from main.period pr where pr.type = 'CONS'`
  const tempPeriods = await DB.select(selectPeriods)
  periods.value = tempPeriods
}

function exportFileUI(){
  hideUI('exportFile')
  typeUI.value = 'exportFile'
}

function hideUI(name){
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

function cashUI(){
  hideUI('cash')
  typeUI.value = 'cash'
}

function hideNotification(name){
  const notification = document.getElementById(name)
  notification.style.display = 'none'
}

async function getReports(){
  const selectPeriod = document.getElementById('period_report')
  const selectedIndexPeriod = selectPeriod.selectedIndex
  const period_str = selectPeriod.options[selectedIndexPeriod].value

  const selectBlock = document.getElementById('block_report')
  const selectedIndexBlock = selectBlock.selectedIndex
  const block_str = selectBlock.options[selectedIndexBlock].value

  if(!isNaN(period_str) && !isNaN(block_str)){
    const period = parseInt(period_str)
    const block = parseInt(block_str)

    await writeTextFile(REPORT_PROD, JSON.stringify({ period_id: `${period}`, block_id: `${block}` })) 
    const response = await fetch(HOST_FROM_EXPORT + 'reports', { method: 'GET' }) 
  }
}

async function getAllPayments(period){
  let selectPayments = ''
  let tempPayments = []
  let temp_payments_count = { payments_count: 0 }

  if(period_id.value !== 0){
    paymentQuery = structuredQueries.general.period
    paymentCountQuery = structuredQueries.general.countPeriod

    selectPayments = `${paymentQuery} limit ${salt}`
    tempPayments = await DB.select(selectPayments, [parseInt(period), parseInt(period)])
    temp_payments_count = await DB.select(paymentCountQuery, [parseInt(period), parseInt(period)])
  }else{
    paymentQuery = structuredQueries.general.query
    paymentCountQuery = structuredQueries.general.count

    selectPayments = `${paymentQuery} limit ${salt}`
    tempPayments = await DB.select(selectPayments)
    temp_payments_count = await DB.select(paymentCountQuery)
  }

  payments_count.value = temp_payments_count.shift().payments_count

  for(let idx = 0; idx < tempPayments.length; idx++){
    tempPayments[idx].checked = false
    tempPayments[idx].id = tempPayments[idx].payment_id

    if(tempPayments[idx].account_id){
      const selectAccountId = `select reference_bbva from main.account where account_id = $1`
      const resultAccount = await DB.select(selectAccountId, [tempPayments[idx].account_id])
      const reference = resultAccount.shift().reference_bbva
      tempPayments[idx].toshow_reference = tempPayments[idx].reference.split('-').shift()

      const selectClientByReference = `select (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.client as cl join main.account as acc on cl.client_id = acc.client_id join main.condominium cd on cd.condominium_id = cl.condominium_id where acc.reference_bbva = $1`
      const resultClient = await DB.select(selectClientByReference, [reference])

      tempPayments[idx].client = resultClient.shift().department
      tempPayments[idx].total = ''
      tempPayments[idx].client_reference = reference
      tempPayments[idx].identification = type_identification.reference
      tempPayments[idx].type_validation = type_validation.not_valid
    }else{
      tempPayments[idx].toshow_reference = tempPayments[idx].reference.split('-').shift()
      tempPayments[idx].client_reference = ''
      tempPayments[idx].client = ''
      tempPayments[idx].total = ''
      tempPayments[idx].identification = type_identification.not_found
      tempPayments[idx].type_validation = type_validation.not_valid
    }
  }

  type_payment.value = ''
  payments.value = tempPayments
}

async function getAllDownloadedPayments(period){
  let selectValidatedPayments = ''
  let tempPayments = []
  let temp_payments_count = { payments_count: 0 }

  if(!isNaN(period)){
    paymentQuery = structuredQueries.downloaded.period
    paymentCountQuery = structuredQueries.downloaded.countPeriod

    selectValidatedPayments = `${paymentQuery} limit ${salt}`
    tempPayments = await DB.select(selectValidatedPayments, [parseInt(period), parseInt(period)])
    temp_payments_count = await DB.select(paymentCountQuery, [parseInt(period), parseInt(period)])
  }else{
    paymentQuery = structuredQueries.downloaded.query
    paymentCountQuery = structuredQueries.downloaded.count

    selectValidatedPayments = `${paymentQuery} limit ${salt}`
    tempPayments = await DB.select(selectValidatedPayments)
    temp_payments_count = await DB.select(paymentCountQuery)
  }

  payments_count.value = temp_payments_count.shift().payments_count

  for(let idx = 0; idx < tempPayments.length; idx++){
    tempPayments[idx].checked = false
    tempPayments[idx].id = tempPayments[idx].payment_id
    tempPayments[idx].toshow_reference = tempPayments[idx].reference.split('-').shift()

    const selectAccountId = `select reference_bbva from main.account where account_id = $1`
    const resultAccount = await DB.select(selectAccountId, [tempPayments[idx].account_id])
    const reference = resultAccount.shift().reference_bbva

    const selectClientByReference = `select (cd.name || ' ' || cd.building || ' | ' || cl.department) as deparment from main.client as cl join main.account as acc on cl.client_id = acc.client_id join main.condominium cd on cd.condominium_id = cl.condominium_id where acc.reference_bbva = $1`
    const resultClient = await DB.select(selectClientByReference, [reference])

    tempPayments[idx].client = resultClient.shift().department
    tempPayments[idx].total = ''
    tempPayments[idx].client_reference = reference
    tempPayments[idx].identification = type_identification.reference
    tempPayments[idx].type_validation = type_validation.valid
  }

  type_payment.value = 'fn'
  current_pay.value = 0

  payments.value = tempPayments
}

async function getAllValidatedPayments(period){
  let selectValidatedPayments = ''
  let tempPayments = []
  let temp_payments_count = { payments_count: 0 }


  if(!isNaN(period)){
    paymentQuery = structuredQueries.found.period
    paymentCountQuery = structuredQueries.found.countPeriod

    selectValidatedPayments = `${paymentQuery} limit ${salt}`
    tempPayments = await DB.select(selectValidatedPayments, [parseInt(period), parseInt(period)])
    temp_payments_count = await DB.select(paymentCountQuery, [parseInt(period), parseInt(period)])
  }else{
    paymentQuery = structuredQueries.found.query
    paymentCountQuery = structuredQueries.found.count

    selectValidatedPayments = `${paymentQuery} limit ${salt}`
    tempPayments = await DB.select(selectValidatedPayments)
    temp_payments_count = await DB.select(paymentCountQuery)
  }

  payments_count.value = temp_payments_count.shift().payments_count

  for(let idx = 0; idx < tempPayments.length; idx++){
    tempPayments[idx].checked = false
    tempPayments[idx].id = tempPayments[idx].payment_id
    tempPayments[idx].toshow_reference = tempPayments[idx].reference.split('-').shift()

    const selectAccountId = `select reference_bbva from main.account where account_id = $1`
    const resultAccount = await DB.select(selectAccountId, [tempPayments[idx].account_id])
    const reference = resultAccount.shift().reference_bbva

    const selectClientByReference = `select (cd.name || ' ' || cd.building || ' | ' || cl.department) as deparment from main.client as cl join main.account as acc on cl.client_id = acc.client_id join main.condominium cd on cd.condominium_id = cl.condominium_id where acc.reference_bbva = $1`
    const resultClient = await DB.select(selectClientByReference, [reference])

    tempPayments[idx].client = resultClient.shift().department
    tempPayments[idx].total = ''
    tempPayments[idx].client_reference = reference
    tempPayments[idx].identification = type_identification.reference
    tempPayments[idx].type_validation = type_validation.valid
  }

  type_payment.value = 'fn'
  current_pay.value = 0

  payments.value = tempPayments
}

async function getAllUnvalidatedPayments(period){
  let selectUnvalidatedPayments = ''
  let tempPayments = []
  let temp_payments_count = { payments_count: 0 }

  if(!isNaN(period)){
    paymentQuery = structuredQueries.not_found.period
    paymentCountQuery = structuredQueries.not_found.countPeriod

    selectUnvalidatedPayments = `${paymentQuery} limit ${salt}`
    tempPayments = await DB.select(selectUnvalidatedPayments, [parseInt(period), parseInt(period)])
    temp_payments_count = await DB.select(paymentCountQuery, [parseInt(period), parseInt(period)])
  }else{
    paymentQuery = structuredQueries.not_found.query
    paymentCountQuery = structuredQueries.not_found.count

    selectUnvalidatedPayments = `${paymentQuery} limit ${salt}`
    tempPayments = await DB.select(selectUnvalidatedPayments)
    temp_payments_count = await DB.select(paymentCountQuery)
  }

  payments_count.value = temp_payments_count.shift().payments_count

  for(let idx = 0; idx < tempPayments.length; idx++){
    tempPayments[idx].checked = false
    tempPayments[idx].id = tempPayments[idx].payment_id
    tempPayments[idx].toshow_reference = tempPayments[idx].reference.split('-').shift()

    tempPayments[idx].client_reference = ''
    tempPayments[idx].client = ''
    tempPayments[idx].total = ''
    tempPayments[idx].identification = type_identification.not_found
    tempPayments[idx].type_validation = type_validation.not_valid
  }

  type_payment.value = 'n_fn'
  current_pay.value = 0

  payments.value = tempPayments
}

async function validate(){
  const temp = payments.value
  for(let item of temp){
    if(item.client_reference !== ''){
      validatePayments.push(item)
      item.type_validation = type_validation.valid
    }
  }

  for(let item of validatePayments){
    const selectAccountId = `select account_id from main.account where reference_bbva = $1`
    const resultAccount = await DB.select(selectAccountId, [item.client_reference])
    const account_id = resultAccount.shift().account_id

    const payment_id = item.payment_id

    const updatePayment = `update main.payment set account_id = $1, validated = true, type_identificacion = $2 where payment_id = $3`
    const result = await DB.execute(updatePayment, [parseInt(account_id), item.identification.code, payment_id])
  }

  payments.value = []
  payments.value = temp
}

async function unvalidate(){
  const temp = payments.value

  for(let item of temp){
    if(item.checked){
      const updatePayment = `update main.payment set account_id = null, validated = false where payment_id = $1`
      await DB.execute(updatePayment, [item.payment_id])

      item.type_validation = type_validation.not_valid
      item.identification = type_identification.not_found
      item.client_reference = ''
      item.client = ''
      item.total = ''
      item.account_id = 0
      item.payment_id = 0
    }
  }

  await getAllPayments()
}

async function showDetails(payment_id){
  const selectPaymentInformation = `select p.payment_id, p.reference, p.account_id, p.description, p.validated, p.done_at, p.amount from main.payment p where payment_id = $1`
  typeUI.value = 'conciliate'
  
  const tempPayment = await DB.select(selectPaymentInformation, [payment_id])
  payment.value = tempPayment.shift()

  const selectClientInformation = `select cl.client_id, acc.account_id, py.payment_id, cl.client from main.condominium cd join main.client cl on cd.condominium_id = cl.condominium_id join main.account acc on cl.client_id = acc.client_id join main.payment py on acc.account_id = py.account_id where py.payment_id = $1`
  let tempClient = await DB.select(selectClientInformation, [payment_id])
  
  if(tempClient.length > 0){
    tempClient = tempClient.shift()

    payment.value.client = tempClient.client
    payment.value.client_reference = tempClient.reference
  }

  const selectSupplies = `select account_id, cl.client_id, cl.client, acc.reference_bbva as reference from main.client cl join main.account acc on cl.client_id = acc.client_id where acc.is_supply = true`
  const tempSupplies = await DB.select(selectSupplies)
  supplies.value = tempSupplies
}

async function showClientDetails(clientName, account_id, client_id){
  let tempClient = await DB.select(structuredQueries.client.queryClient, [client_id])

  if(tempClient.length > 0){
    tempClient = tempClient.shift()
    tempClient.client = clientName
    tempClient.account_id = account_id
    tempClient.liters = 0
    tempClient.debt = 0
    tempClient.total = 0
    client.value = tempClient

    typeUI.value = 'consumption'
  }
}

async function showClientConsumption(event){
  const period_id = isNaN(event.target.value) ? 0 : parseInt(event.target.value)
  const tempIsSupplier = await DB.select(structuredQueries.client.queryIsSupplier, [client.value.client_id])
  const isSupplier = tempIsSupplier.length > 0

  if(period_id !== 0 && !isSupplier){
    const tempClient = client.value
    const tempConsumption = await DB.select(structuredQueries.client.queryClientInformation, [period_id, client.value.client_id])
    client.value = tempConsumption.length > 0 ? tempConsumption.shift() : tempClient
  }
}

function isClose(a, b, relTol = 1e-9, absTol = 0) {
    const diff = Math.abs(a - b)
    return diff <= Math.max(relTol * Math.abs(a), absTol)
}

async function checkTolerance(event){
  const str = event.target.value // description (string: 8-11), amount (d, d.d), tolerance (d, d%), amount:tolerance (d:d, d:d%)
  const amountRegex = /^-?\d+(\.\d+)?:$/
  const toleranceRegex = /^:-?\d+(\.\d+)?%?$/
  const amountToleranceRegex = /^-?\d+(\.\d+)?%?:-?\d+(\.\d+)?%?$/

  if(amountToleranceRegex.test(str) || toleranceRegex.test(str) || amountRegex.test(str)){
    const tempPayments = await DB.select(structuredQueries.payments.queryNotAssigned)
    paymentsToAssign.value = tempPayments
  }

  if(amountToleranceRegex.test(str)){
    const [amount, tolerance] = str.split(':')
    let tempPayments = paymentsToAssign.value
    if(tolerance.includes('%')){
      const percent = parseFloat(tolerance.replaceAll('%', ''))
      tempPayments = tempPayments.filter(item => isClose(parseFloat(amount), item.amount, percent / 100.0, 0))
      paymentsToAssign.value = tempPayments
    }else{
      tempPayments = tempPayments.filter(item => isClose(parseFloat(amount), item.amount, 0, tolerance))
      paymentsToAssign.value = tempPayments
    }
  }else if(toleranceRegex.test(str)){
    const tolerance = str.replaceAll(':', '')
    if(tolerance.includes('%')){
      let tempPayments = paymentsToAssign.value
      const percent = parseFloat(tolerance.replaceAll('%', ''))
      tempPayments = tempPayments.filter(item => isClose(client.value.total, item.amount, percent / 100.0, 0))
      paymentsToAssign.value = tempPayments
    }else{
      let tempPayments = paymentsToAssign.value
      tempPayments = tempPayments.filter(item => isClose(client.value.total, item.amount, 0, tolerance))
      paymentsToAssign.value = tempPayments
    }
  }else if(amountRegex.test(str)){
    const [amount] = str.split(':')
    let tempPayments = paymentsToAssign.value
    tempPayments = tempPayments.filter(item => isClose(amount, item.amount))
    paymentsToAssign.value = tempPayments
  }
}

async function checkClient(event){
  const str = event.target.value
  const params = str.split(':')

  if(params.length === 2){
    const [type, supply] = params

    if(type.toLowerCase() === 's'){
      const selectSupply = `select cl.client_id, cl.client, acc.account_id, acc.reference_bbva as reference from main.client cl join main.account acc on acc.client_id = cl.client_id where identifier = '' and client ilike '%${supply}%'`
      const tempSupplies = await DB.select(selectSupply)
      supplies.value = tempSupplies
    }

  }else if(params.length === 3){
    const [type, block, condominium] = params

    if(type.toLowerCase() === 'c'){
      const selectClient = `select cl.client_id, cl.client, acc.account_id, acc.reference_bbva as reference from main.condominium cd join main.client cl on cd.condominium_id = cl.condominium_id join main.account acc on acc.client_id = cl.client_id where cd.block = ${block} and cl.client ilike '%${condominium}%'`
      const tempClients = await DB.select(selectClient)
      supplies.value = tempClients
    }
  }else
    supplies.value = []
}

async function assignPayment(client, account_id){
  const payment_id = payment.value.payment_id

  if(payment_id === undefined)
    return

  const updatePaymentSelected = `update main.payment set account_id = $1, type_identificacion = 'am' where payment_id = $2`
  await DB.execute(updatePaymentSelected, [account_id, payment_id])
  payment.value.client = client
  await getAllPayments()
}

async function assignToClient(payment_id){
  const updatePayment = `update main.payment set account_id = $1, validated = true, type_identificacion = 'am' where payment_id = $2`
  const account_id = client.value.account_id
  
  await DB.execute(updatePayment, [account_id, payment_id])
  paymentsToAssign.value = []
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

  const insertPayment = `insert into main.payment (account_id, description, amount, done_at, validated, to_download, downloaded, type_identificacion, reference) values ($1, $2, $3, '${date}', true, null, null, 'ch', '00000000-9:9')`
  await DB.execute(insertPayment, [client.value.account_id, description, parseFloat(amount)])

  document.getElementById('paymentDescription').value = ''
  document.getElementById('paymentAmount').value = ''
  document.getElementById('paymentDate').value = ''

  
  notif.title = 'Registro exitoso',
  notif.description = 'El registro del pago en efectivo se ha realizado con éxito.'

  notification.value = notif
  document.getElementById('notification').style.display = 'block'
}

async function deletePayment(payment_id){
  const deletePayment = `delete from main.payment where payment_id = $1`
  await DB.execute(deletePayment, [payment_id])

  await paymentsClientUI()
}

async function unassign(payment_id){
  const unassignPayment = `update main.payment set account_id = null, validated = false, type_identificacion = null, to_download = false, downloaded = false where payment_id = $1`
  await DB.execute(unassignPayment, [payment_id])

  await paymentsClientUI()
}

async function showPerPage(value){
  const isNumber = !isNaN(value.target.value)
  let tempPayments = []

  if(period_id.value !== 0 && isNumber){
    salt = parseInt(value.target.value)
    tempPayments = await DB.select(`${paymentQuery} limit ${salt}`, [period_id.value, period_id.value])
  }else if (isNumber){
    salt = parseInt(value.target.value)
    tempPayments = await DB.select(`${paymentQuery} limit ${salt}`)
  }else if(period_id.value !== 0)
    tempPayments = await DB.select(paymentQuery, [period_id.value, period_id.value])
  else
    tempPayments = await DB.select(paymentQuery)

  for(let idx = 0; idx < tempPayments.length; idx++){
    if(tempPayments[idx].account_id){
      const selectAccountId = `select reference_bbva from main.account where account_id = $1`
      const resultAccount = await DB.select(selectAccountId, [tempPayments[idx].account_id])
      const reference = resultAccount.shift().reference_bbva
      tempPayments[idx].toshow_reference = tempPayments[idx].reference.split('-').shift()

      const selectClientByReference = `select (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.client as cl join main.account as acc on cl.client_id = acc.client_id join main.condominium cd on cd.condominium_id = cl.condominium_id where acc.reference_bbva = $1`
      const resultClient = await DB.select(selectClientByReference, [reference])

      tempPayments[idx].checked = false
      tempPayments[idx].client = resultClient.shift().department
      tempPayments[idx].total = ''
      tempPayments[idx].client_reference = reference
      tempPayments[idx].identification = type_identification.reference
      tempPayments[idx].type_validation = type_validation.valid
    }else{
      tempPayments[idx].toshow_reference = tempPayments[idx].reference.split('-').shift()
      tempPayments[idx].checked = false
      tempPayments[idx].id = tempPayments[idx].payment_id
      tempPayments[idx].client_reference = ''
      tempPayments[idx].client = ''
      tempPayments[idx].total = ''
      tempPayments[idx].identification = type_identification.not_found
      tempPayments[idx].type_validation = type_validation.not_valid
    }
  }

  payments.value = []
  payments.value = tempPayments
}

async function makeMatchClient(newMatch){
  const matchClients = []
  const selectClient = `select distinct(cl.client_id) as client_id, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.client cl join main.condominium cd on cl.condominium_id = cd.condominium_id join main.account acc on cl.client_id = acc.client_id where acc.reference_bbva = $1`

  for(let match of newMatch){ 
    const resultClient = await DB.select(selectClient, [match.reference])
    const client = resultClient.pop()
    client.reference = match.reference
    matchClients.push(client)
  }

  return matchClients
}

async function getNextPayments(){
  let tempCount = 0
  if(period_id.value !== 0)
    tempCount = await DB.select(paymentCountQuery, [period_id.value, period_id.value])
  else
    tempCount = await DB.select(paymentCountQuery)

  payments_count.value = tempCount.shift().payments_count
  const tempOffset = current_pay.value + salt < payments_count.value ? current_pay.value + salt : payments_count.value
  let temp = []

  if(period_id.value !== 0)
    temp = await DB.select(`${paymentQuery} limit ${salt} offset ${tempOffset}`, [period_id.value, period_id.value])
  else
    temp = await DB.select(`${paymentQuery} limit ${salt} offset ${tempOffset}`)


  for(let idx = 0; idx < temp.length; idx++){
    if(temp[idx].account_id){
      const selectAccountId = `select reference_bbva from main.account where account_id = $1`
      const resultAccount = await DB.select(selectAccountId, [temp[idx].account_id])
      const reference = resultAccount.shift().reference_bbva
      temp[idx].toshow_reference = temp[idx].reference.split('-').shift()

      const selectClientByReference = `select (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.client as cl join main.account as acc on cl.client_id = acc.client_id join main.condominium cd on cd.condominium_id = cl.condominium_id where acc.reference_bbva = $1`
      const resultClient = await DB.select(selectClientByReference, [reference])

      temp[idx].checked = false
      temp[idx].client = resultClient.shift().department
      temp[idx].total = ''
      temp[idx].client_reference = reference
      temp[idx].identification = type_identification.reference
      temp[idx].type_validation = type_validation.valid
    }else{
      temp[idx].toshow_reference = temp[idx].reference.split('-').shift()
      temp[idx].checked = false
      temp[idx].id = temp[idx].payment_id
      temp[idx].client_reference = ''
      temp[idx].client = ''
      temp[idx].total = ''
      temp[idx].identification = type_identification.not_found
      temp[idx].type_validation = type_validation.not_valid
    }
  }

  if(temp.length > 0 && tempOffset < payments_count.value){
    payments.value = []
    payments.value = temp
    current_pay.value = tempOffset
  }
}

async function getPreviousPayments(){
  let tempCount = 0
  if(period_id.value !== 0)
    tempCount = await DB.select(paymentCountQuery, [period_id.value, period_id.value])
  else
    tempCount = await DB.select(paymentCountQuery)

  payments_count.value = tempCount.shift().payments_count
  const tempOffset = (current_pay.value - salt) > -1 ? current_pay.value - salt : 0
  let temp = []

  if(period_id.value !== 0)
    temp = await DB.select(`${paymentQuery} limit ${salt} offset ${tempOffset}`, [period_id.value, period_id.value])
  else
    temp = await DB.select(`${paymentQuery} limit ${salt} offset ${tempOffset}`)

  for(let idx = 0; idx < temp.length; idx++){
    if(temp[idx].account_id){
      const selectAccountId = `select reference_bbva from main.account where account_id = $1`
      const resultAccount = await DB.select(selectAccountId, [temp[idx].account_id])
      const reference = resultAccount.shift().reference_bbva
      temp[idx].toshow_reference = temp[idx].reference.split('-').shift()

      const selectClientByReference = `select (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.client as cl join main.account as acc on cl.client_id = acc.client_id join main.condominium cd on cd.condominium_id = cl.condominium_id where acc.reference_bbva = $1`
      const resultClient = await DB.select(selectClientByReference, [reference])

      temp[idx].checked = false
      temp[idx].client = resultClient.shift().department
      temp[idx].total = ''
      temp[idx].client_reference = reference
      temp[idx].identification = type_identification.reference
      temp[idx].type_validation = type_validation.valid
    }else{
      temp[idx].toshow_reference = temp[idx].reference.split('-').shift()
      temp[idx].checked = false
      temp[idx].id = temp[idx].payment_id
      temp[idx].client_reference = ''
      temp[idx].client = ''
      temp[idx].total = ''
      temp[idx].identification = type_identification.not_found
      temp[idx].type_validation = type_validation.not_valid
    }
  }

  if(temp.length > -1 && tempOffset > -1){
    payments.value = []
    payments.value = temp
    current_pay.value = tempOffset
  }
}
</script>
<template>
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

  <!-- BANCOS -->
  <div id="banks" class="flex mr-6 min-w-[800px] min-h-[600px]">
    <div class="sm:max-w-[80vw] sm:w-[80vw] border max-h-screen mt-4 mx-4 shadow-md">
      <div class="py-2 mx-4 flex justify-between">
        <h3 class="text-md font-bold">Todos los pagos</h3>
        <div class="flex gap-4 items-center">
          <div id="conciliate">
            <button @click="conciliate" class="option conciliate flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-width="1" d="M6 4v10m0 0a2 2 0 1 0 0 4m0-4a2 2 0 1 1 0 4m0 0v2m6-16v2m0 0a2 2 0 1 0 0 4m0-4a2 2 0 1 1 0 4m0 0v10m6-16v10m0 0a2 2 0 1 0 0 4m0-4a2 2 0 1 1 0 4m0 0v2"/>
              </svg>              
              <span id="title-conciliate" class="title text-md font-light ml-2">Conciliar</span>          
            </button>
          </div>
          <div id="consumptionUI">
            <button @click="consumptionUI" class="option consumption flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M10 6.025A7.5 7.5 0 1 0 17.975 14H10V6.025Z"/>
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M13.5 3c-.169 0-.334.014-.5.025V11h7.975c.011-.166.025-.331.025-.5A7.5 7.5 0 0 0 13.5 3Z"/>
              </svg>              
              <span id="title-consumption" class="title text-md font-light ml-2">Consumos</span>  
            </button>
          </div>
          <div id="paymentsClientUI">
            <button @click="paymentsClientUI" class="option paymentClient flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M5 18h14M5 18v3h14v-3M5 18l1-9h12l1 9M16 6v3m-4-3v3m-2-6h8v3h-8V3Zm-1 9h.01v.01H9V12Zm3 0h.01v.01H12V12Zm3 0h.01v.01H15V12Zm-6 3h.01v.01H9V15Zm3 0h.01v.01H12V15Zm3 0h.01v.01H15V15Z"/>
              </svg>                                         
              <span id="title-paymentClient" class="title text-md font-light ml-2">Pagos</span>  
            </button>
          </div>
          <div id="cashUI">
            <button @click="cashUI" class="option cash flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-width="1" d="M8 7V6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-1M3 18v-7a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm8-3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>
              </svg>                                      
              <span id="title-cash" class="title text-md font-light ml-2">Efectivo</span>  
            </button>
          </div>
          <div id="filter">
            <button @click="filterUI" class="option filter flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-width="1" d="M18.796 4H5.204a1 1 0 0 0-.753 1.659l5.302 6.058a1 1 0 0 1 .247.659v4.874a.5.5 0 0 0 .2.4l3 2.25a.5.5 0 0 0 .8-.4v-7.124a1 1 0 0 1 .247-.659l5.302-6.059c.566-.646.106-1.658-.753-1.658Z"/>
              </svg>
              <span id="title-filter" class="title text-md font-light ml-2">Filtrar</span>          
            </button>
          </div>
          <div id="report">
            <button @click="reportUI" class="option report flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M10 3v4a1 1 0 0 1-1 1H5m4 10v-2m3 2v-6m3 6v-3m4-11v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1Z"/>
              </svg>              
              <span id="title-report" class="title text-md font-light ml-2">Reportes</span>          
            </button>
          </div>
          <div id="export">
            <button @click="exportFileUI" class="option exportFile flex border rounded-lg py-1 px-3 hover:bg-slate-100 hover:text-gray-700">
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
                <input id="checkPayments" type="checkbox" @change="checkAllPayments" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2">
              </th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">ID pago</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Fecha</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Descripción</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cantidad</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Emparejamiento por</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Clave referenciada</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cliente</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Detalles</th>
              <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Validación</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr class="odd:bg-white even:bg-gray-100" v-for="payment in payments">
              <td class="pl-4 whitespace-nowrap">
                <input :id="payment.id" type="checkbox" :value="payment.checked" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" :checked="payment.checked" @click="checkPayment(payment)">
              </td>
              <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">{{ payment.toshow_reference }}</td>
              <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ payment.done_at }}</td>
              <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ payment.description }}</td>
              <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">$ {{ payment.amount.toLocaleString() }}</td>
              <td class="p-2 whitespace-nowrap">
                <span :class="payment.identification.classes">{{ payment.identification.name }}</span>
              </td>
              <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ payment.client_reference }}</td>
              <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ payment.client }}</td>
              <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">
                <button class="rounded-full border p-1 hover:bg-slate-200 hover:opacity-80" @click="showDetails(payment.payment_id)">
                  <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-width="1" d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z"/>
                    <path stroke="currentColor" stroke-width="1" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                  </svg>                  
                </button>
              </td>
              <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">
                <span :class="payment.type_validation.classes">{{ payment.type_validation.name }}</span>
              </td>
            </tr>                 
          </tbody>
        </table>
      </div>
      <div class="m-4 relative flex justify-center items-center gap-2 b-2">
        <div>
          <select id="perPage" @change="showPerPage" class="w-full bg-transparent text-sm placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-lg pl-2 pr-1 py-1 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
            <option selected value="10">10 por página</option> 
            <option value="50">50 por página</option> 
            <option value="75">75 por página</option> 
            <option value="100">100 por página</option>
            <option value="all">Todos</option> 
          </select>
        </div>
        <div class="flex justify-center items-center gap-2">
          <div @click="getPreviousPayments" class="hover:cursor-pointer hover:bg-gray-200 rounded py-1">
            <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7"/>
            </svg> 
          </div>
          <p class="font-normal text-black">{{ current_pay }} de {{ payments_count }} </p>   
          <div @click="getNextPayments" class="hover:cursor-pointer hover:bg-gray-200 rounded py-1">
            <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/>
            </svg>  
          </div>
        </div>
        <div>
          <p class="font-normal text-black">Identificados: {{ index_identifier }} - Analizados: {{ matchedPayments }} de {{ count_identifier }} </p>
        </div>          
      </div>
    </div>
  
    <div class="w-[50vw] h-[87vh] relative right-0 shadow-md border mt-4">
      <div id="conci" v-if="typeUI === 'conciliate'">
        <h3 class="ml-2 mt-2 font-bold">Conciliación</h3>
        <div class="relative w-[calc(100%-1rem)] ml-2 mt-2">
          <select id="method" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
            <option selected>Selecione una opción</option> 
            <option value="cr">Clave referenciada</option>
          </select>
          <svg class="w-5 h-5 text-gray-800 absolute top-1 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
          </svg>
        </div>
        <div class="mt-4 ml-2 mr-2 flex-col">
          <div class="flex mr-4 mt-2 justify-between w-full gap-2">
            <button @click="start" class="w-1/2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Seleccionar</button>
            <button @click="validate" class="w-1/2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-green-600 p-2">Validar</button>
          </div>
          <button @click="unvalidate" class="w-full mt-2 text-white bg-red-700 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-red-600 p-2">Quitar Validación</button>
        </div>

        <hr class="mt-2">

        <div class="p-2 overflow-y-auto">
          <input id="pattern" type="text" @keyup.enter="checkClient" class="border mt-2 mb-2 text-xs rounded-md block w-full px-2 py-2 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce el patrón de busqueda">
          <div class="border rounded-lg p-2 mb-2 shadow-md" v-if="payment">
            <header class="border-b border-gray-600 pb-2">
              <h3 class="text-sm font-semibold">ID Pago: <span class="text-slate-500 font-normal">{{ payment.reference }}</span></h3>
              <p class="text-[11px] text-slate-600 font-semibold"></p>
            </header>
            <section class="flex-col space-y-1">
              <p class="text-xs mt-2 font-semibold">Descripción: <span class="text-slate-600 font-light">{{ payment.description }}</span></p>
              <p class="text-xs font-semibold">Fecha de pago: <span class="text-sm text-slate-600 font-light">{{ payment.done_at }}</span></p>
              <p class="text-xs font-semibold">Monto: <span class="text-sm text-slate-600 font-light">$ {{ payment.amount }}</span></p>
              <p class="text-xs font-semibold">Asignado a: <span class="text-sm text-slate-600 font-light">{{ payment.client }}</span></p>
            </section>
          </div>
        </div>

        <hr>

        <div class="p-2 overflow-y-auto h-[30vh]">
          <div class="border rounded-lg p-2 mb-2 shadow-md" v-for="supply in supplies">
            <header class="border-b border-gray-600 pb-2 flex justify-between items-center">
              <h3 class="text-md font-bold">Suministro: <span class="text-slate-500 font-normal">{{ supply.client_id }}</span></h3>
            </header>
            <section class="flex-col space-y-1 mb-2">
              <p class="text-xs mt-2 font-semibold">Nombre: <span class="text-slate-600 font-light">{{ supply.client }}</span></p>
              <p class="text-xs font-semibold">Referencia: <span class="text-sm text-slate-600 font-light">{{ supply.reference }}</span></p>
            </section>
            <div class="flex justify-around gap-2 mb-2 border-t border-gray-600">
              <button @click="assignPayment(supply.client, supply.account_id)" class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Asignar</button>
              <button @click="showClientDetails(supply.client, supply.account_id, supply.client_id)" class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Ver detalle</button>
            </div>
          </div>
        </div>

      </div>

      <div id="filter" class="mx-2" v-else-if="typeUI === 'filter'">
        <h3 class="mt-2 font-bold">Filtrar</h3>
        <div class="relative w-[calc(100%)] mt-2">
          <select id="type_filter" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
            <option selected>Selecione una opción</option> 
            <option value="fn">Identificado</option>
            <option value="n_fn">No identificado</option>
            <option value="dw">Descargados</option>
            <option value="ef">Efectivo</option>
          </select>
          <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
          </svg>              
        </div>
        <div class="relative w-[calc(100%)] mt-2">
          <select id="period_filter" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
            <option selected>Selecione una opción</option> 
            <option :value="period.period_id" v-for="period in periods">{{ period.name }}</option>
          </select>
          <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
          </svg>              
        </div>
        <button @click="filter" class="w-full mt-2 mr-4 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-red-600 p-2">Filtrar</button>
        <button @click="deleteFilter" class="w-full mt-2 mr-4 text-white bg-red-700 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-red-600 p-2">Eliminar filtro</button>
      </div>

      <div id="exp" v-else-if="typeUI === 'exportFile'">
        <h3 class="ml-2 mt-2 font-bold">Exportar</h3>
        <div class="w-full mt-2">
          <input id="filePath" type="text" disabled :value="selectedFileName" class="border text-slate-400 rounded-md text-sm w-full p-1 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Seleccionar archivo">
          <div class="flex gap-2">
            <button @click="selectFile" class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Seleccionar</button>
            <button @click="exportFile" class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2">Exportar</button>
          </div>
        </div>
      </div>

      <div v-else-if="typeUI === 'paymentClient'">
        <h3 class="ml-2 mt-2 font-bold">Pagos</h3>
        <div class="p-2 overflow-y-auto">
          <div class="relative w-[calc(100%)] mt-2 mb-2">
            <select id="period_filter" @change="showClientConsumption" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
              <option selected>Selecione una opción</option> 
              <option :value="period.period_id" v-for="period in periods">{{ period.name }}</option>
            </select>
            <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
            </svg>              
          </div>
          <div class="border rounded-lg p-2 mb-2 shadow-md" v-if="client">
            <header class="border-b border-gray-600 pb-2">
              <h3 class="text-sm font-semibold">ID Cliente: <span class="text-slate-500 font-normal">{{ client.client_id }}</span></h3>
              <p class="text-[11px] text-slate-600 font-semibold"></p>
            </header>
            <section class="flex-col space-y-1">
              <p class="text-xs mt-2 font-semibold">Nombre: <span class="text-slate-600 font-light">{{ client.client }}</span></p>
              <p class="text-xs font-semibold">Referencia: <span class="text-sm text-slate-600 font-light">{{ client.reference }}</span></p>
              <p class="text-xs font-semibold">Consumo: <span class="text-sm text-slate-600 font-light">{{ client.liters }} Lts.</span></p>
              <p class="text-xs font-semibold">Adeudo: <span class="text-sm text-slate-600 font-light">$ {{ client.debt }}</span></p>
              <p class="text-xs font-semibold">Total: <span class="text-sm text-slate-600 font-light">$ {{ client.total }}</span></p>
            </section>
          </div>
        </div>

        <hr>

        <div class="p-2 overflow-y-auto h-[48vh] w-[calc(100%)]">
          <div class="relative mt-2">
            <div class="overflow-y-auto h-[37vh]">
              <div class="border rounded-lg p-2 mb-2 mt-2 shadow-md" v-for="payment in paymentsToShow">
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
                  <button class="w-full mt-2 text-white bg-yellow-600 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="unassign(payment.payment_id)">Quitar asignación</button>
                  <button class="w-full mt-2 text-white bg-red-700 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="deletePayment(payment.payment_id)">Eliminar pago</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div id="pays" v-else-if="typeUI === 'cash'">
        <h3 class="ml-2 mt-2 font-bold">Efectivo</h3>
        <div class="border rounded-lg p-2 mb-2 shadow-md w-[calc(100%-1rem)] mt-2 ml-2" v-if="client">
          <header class="border-b border-gray-600 pb-2">
            <h3 class="text-sm font-semibold">ID Cliente: <span class="text-slate-500 font-normal">{{ client.client_id }}</span></h3>
            <p class="text-[11px] text-slate-600 font-semibold"></p>
          </header>
          <section class="flex-col space-y-1">
            <p class="text-xs mt-2 font-semibold">Nombre: <span class="text-slate-600 font-light">{{ client.client }}</span></p>
            <p class="text-xs font-semibold">Referencia: <span class="text-sm text-slate-600 font-light">{{ client.reference }}</span></p>
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

      <div id="pays" v-else-if="typeUI === 'report'">
        <h3 class="ml-2 mt-2 font-bold">Reportes</h3>

        <div class="relative w-[calc(96%)] ml-1 mt-2">
          <select id="period_report" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
            <option selected>Selecione un periodo</option> 
            <option :value="period.period_id" v-for="period in periods">{{ period.name }}</option>
          </select>
          <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
          </svg>              
        </div>

        <div class="relative w-[calc(96%)] ml-1 mt-2">
          <select id="block_report" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
            <option selected>Selecione un bloque</option> 
            <option value="1">Bloque 1</option>
            <option value="2">Bloque 2</option>
            <option value="3">Bloque 3</option>
            <option value="4">Bloque 4</option>
          </select>
          <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
          </svg>              
        </div>

        <button class="w-[calc(96%)] ml-1 mt-2 text-white bg-green-700 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="getReports">Descargar reportes</button>
      </div>

      <div id="pays" v-else-if="typeUI === 'consumption'">
        <h3 class="ml-2 mt-2 font-bold">Consumos</h3>
        <div class="p-2 overflow-y-auto">
          <div class="relative w-[calc(100%)] mt-2 mb-2">
            <select id="period_filter" @change="showClientConsumption" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
              <option selected>Selecione una opción</option> 
              <option :value="period.period_id" v-for="period in periods">{{ period.name }}</option>
            </select>
            <svg class="w-5 h-5 text-gray-800 absolute top-2 right-2 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
            </svg>              
          </div>
          <div class="border rounded-lg p-2 mb-2 shadow-md" v-if="client">
            <header class="border-b border-gray-600 pb-2">
              <h3 class="text-sm font-semibold">ID Cliente: <span class="text-slate-500 font-normal">{{ client.client_id }}</span></h3>
              <p class="text-[11px] text-slate-600 font-semibold"></p>
            </header>
            <section class="flex-col space-y-1">
              <p class="text-xs mt-2 font-semibold">Nombre: <span class="text-slate-600 font-light">{{ client.client }}</span></p>
              <p class="text-xs font-semibold">Referencia: <span class="text-sm text-slate-600 font-light">{{ client.reference }}</span></p>
              <p class="text-xs font-semibold">Consumo: <span class="text-sm text-slate-600 font-light">{{ client.liters }} Lts.</span></p>
              <p class="text-xs font-semibold">Adeudo: <span class="text-sm text-slate-600 font-light">$ {{ client.debt }}</span></p>
              <p class="text-xs font-semibold">Total: <span class="text-sm text-slate-600 font-light">$ {{ client.total }}</span></p>
            </section>
          </div>
        </div>

        <hr>

        <div class="p-2 overflow-y-auto h-[48vh] w-[calc(100%)]">
          <input id="tolerance" type="text" @keyup.enter="checkTolerance" class="border mt-2 text-xs rounded-md block w-full px-2 py-2 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Introduce referencia ó la cifra de tolerancia (% ó $)">

          <div class="relative mt-2">
            <div class="overflow-y-auto h-[37vh]">
              <div class="border rounded-lg p-2 mb-2 mt-2 shadow-md" v-for="payment in paymentsToAssign">
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
                  <button class="w-full mt-2 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="assignToClient(payment.payment_id)">Asignar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>