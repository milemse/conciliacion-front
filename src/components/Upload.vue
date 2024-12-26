<script setup>
import { onBeforeMount, ref } from 'vue'

import { read } from 'xlsx'
import { readFile } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import Database from '@tauri-apps/plugin-sql'

import { linker_payments } from '../utils/linker_payments'
import { linker_consumptions } from '../utils/linker_consumptions'
import { linker_tanks } from '../utils/linker_tanks'
import { getPaymentsInformation, uploadPayments, getConsumptionsInformation, uploadConsumptions, getTanksInformation } from '../services/excel'

const type_upload = {
  upload: {
    name: 'Cargado',
    classes: 'bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-green-100'
  },
  not_upload: {
    name: 'No cargado',
    classes: 'bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-md border border-red-100'
  }
}
let DB = { }
const selectedFilePath = ref('')
const paymentsToShow = ref([])
let totalOfPayments = []
const consumptionsToShow = ref([])
let totalOfConsumptions = []
const tanksToShow = ref([])
let totalOfTanks = []
const count = ref(0)
const toShowType = ref('')
const param_id = ref(0)
let fileType = ''
const position = ref({
    start: 0,
    end: 10,
    salt: 10
})

const options = {
    period: {
        name: 'Selecciona un periodo',
        options: [] //
    },
    block: {
        name: 'Selecciona un bloque',
        options: [
            { value: 1, name: 'Bloque 1' },
            { value: 2, name: 'Bloque 2' },
            { value: 3, name: 'Bloque 3' },
            { value: 4, name: 'Bloque 4' }
        ]
    }
}

const optionsToShow = ref({
    name: '',
    options: []
})

const notification = ref({
  title: '',
  description: ''
})

let PROVEE_TEST = ''

// metodos select() y execute()
onBeforeMount(async function () {
    PROVEE_TEST = await invoke('get_enviroment_variable', { name: 'PROVEE_TEST' })
    DB = await Database.load(PROVEE_TEST)
})

async function selectOption(){
    const selectPeriodsBanks = `select period_id, name from main.period where type = 'PAYS'`
    const selectPeriodsBlocks = `select period_id, name from main.period where type = 'CONS'`

    const fileTypeInput = document.getElementById('fileType')
    const selectedIndex = fileTypeInput.selectedIndex
    fileType = fileTypeInput.options[selectedIndex].value

    const tempOptionsToShow = {
        name: '',
        options: []
    }
    let tempPeriods = []

    switch(fileType){
        case 'fz':
            tempPeriods = await DB.select(selectPeriodsBanks)
            options.period.options = tempPeriods
            tempOptionsToShow.name = options.period.name
            tempOptionsToShow.options = options.period.options

            optionsToShow.value = tempOptionsToShow
        break
        case 'rd':
            tempPeriods = await DB.select(selectPeriodsBlocks)
            options.period.options = tempPeriods
            tempOptionsToShow.name = options.period.name
            tempOptionsToShow.options = options.period.options

            optionsToShow.value = tempOptionsToShow
        break
        case 'tk':
            options.period.options = tempPeriods
            tempOptionsToShow.name = options.block.name
            tempOptionsToShow.options = options.block.options

            optionsToShow.value = tempOptionsToShow
        break
    }
}

async function start(){
    const fileTypeInput = document.getElementById('fileType')
    const selectedIndex = fileTypeInput.selectedIndex
    fileType = fileTypeInput.options[selectedIndex].value

    let selectedFile = ''
    let toUploadFile = {}
    let workbook = {}

    switch(fileType){
        case 'fz':
            selectedFile = await open({
                title: 'Selecciona tu archivo',
                multiple: false,
                directory: false,
                filters: [ { name: "Archivo de pagos", extensions: ["xlsx"] } ]
            })
            if(selectedFile !== null){
                toUploadFile = await readFile(selectedFile)
                workbook = read(toUploadFile)
                showPayments(workbook)
                toShowType.value = 'fz'
            }else{
                notification.value.title = 'Archivo no seleccionado'
                notification.value.description = 'No se ha seleccionado un archivo para cargar los pagos.'
                document.getElementById('notification').style.display = 'block'
            }
        break
        case 'rd':
            selectedFile = await open({
                title: 'Selecciona tu archivo',
                multiple: false,
                directory: false,
                filters: [ { name: "Archivo de consumos", extensions: ["xlsx"] } ]
            })
            if(selectedFile !== null){
                toUploadFile = await readFile(selectedFile)
                workbook = read(toUploadFile)
                showConsumptions(workbook)
                toShowType.value = 'rd'
            }else{
                notification.value.title = 'Archivo no seleccionado'
                notification.value.description = 'No se ha seleccionado un archivo para cargar los consumos.'
                document.getElementById('notification').style.display = 'block'
            }
        break
        case 'tk':
            selectedFile = await open({
                title: 'Selecciona tu archivo',
                multiple: false,
                directory: false,
                filters: [ { name: "Archivo de tanques", extensions: ["xlsx"] } ]
            })
            if(selectedFile !== null){
                toUploadFile = await readFile(selectedFile)
                workbook = read(toUploadFile)
                showTanks(workbook)
                toShowType.value = 'tk'
            }else{
                notification.value.title = 'Archivo no seleccionado'
                notification.value.description = 'No se ha seleccionado un archivo para cargar las lecturas de tanques.'
                document.getElementById('notification').style.display = 'block'
            }
        break
    }

    selectedFilePath.value = selectedFile
}

async function upload() {
    switch(fileType){
        case 'fz':
            await uploadPayments(DB, totalOfPayments, type_upload.upload)
            paymentsToShow.value = []
            paymentsToShow.value = totalOfPayments.slice(position.value.start, position.value.end)
        break
        case 'rd':
            await uploadConsumptions(DB, totalOfConsumptions, type_upload.upload, param_id.value)
            consumptionsToShow.value = []
            consumptionsToShow.value = totalOfConsumptions.slice(position.value.start, position.value.end)
        break
        case 'tk':
            await uploadTanks(DB, totalOfTanks, type_upload.upload)
            tanksToShow.value = []
            tanksToShow.value = totalOfTanks.slice(position.value.start, position.value.end)
        break
    }
}

async function showPayments(workbook){
    totalOfPayments = await getPaymentsInformation(workbook, linker_payments, type_upload, DB)
    totalOfPayments.forEach(item => {
        item.referenceToShow = item.reference.split('-').shift()
    })
    count.value = totalOfPayments.length
    const tempPayments = totalOfPayments.slice(position.value.start, position.value.end)

    paymentsToShow.value = tempPayments
}

function showConsumptions(workbook){
    totalOfConsumptions = getConsumptionsInformation(workbook, linker_consumptions, type_upload)
    count.value = totalOfConsumptions.length
    consumptionsToShow.value = totalOfConsumptions.slice(position.value.start, position.value.end)
}

function showTanks(workbook){
    totalOfTanks = getTanksInformation(workbook, linker_tanks, param_id.value, type_upload)
    count.value = totalOfTanks.length
    tanksToShow.value = totalOfTanks.slice(position.value.start, position.value.end)
}

function getParamId(value){
    if(!isNaN(value.target.value))
        param_id.value = parseInt(value.target.value)
}

function hideNotification(name){
  const notification = document.getElementById(name)
  notification.style.display = 'none'
}

function getPrevious(){
    const temp = position.value.end - position.value.salt
    if(temp < 0)
        return
    
    position.value.start = position.value.start < 0 ? 0 : position.value.start - position.value.salt
    position.value.end = position.value.end === 0 ? 10 : position.value.end - position.value.salt

    if(toShowType.value === 'fz')
        paymentsToShow.value = totalOfPayments.slice(position.value.start, position.value.end)
    else if(toShowType.value === 'rd')
        consumptionsToShow.value = totalOfConsumptions.slice(position.value.start, position.value.end)
    else if(toShowType.value === 'tk')
        tanksToShow.value = totalOfTanks.slice(position.value.start, position.value.end)
}

function getNext(){
    const temp = position.value.end + position.value.salt
    if(temp > count.value)
        return

    position.value.start += position.value.salt
    position.value.end += position.value.salt
    
    if(toShowType.value === 'fz')
        paymentsToShow.value = totalOfPayments.slice(position.value.start, position.value.end)
    else if(toShowType.value === 'rd')
        consumptionsToShow.value = totalOfConsumptions.slice(position.value.start, position.value.end)
    else if(toShowType.value === 'tk')
        tanksToShow.value = totalOfTanks.slice(position.value.start, position.value.end)
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
    <h1 class="mt-4 ml-6 text-md font-semibold">Carga de pagos</h1>
    <div class="flex mt-4">
        <div class="relative mx-4 w-3/5">
            <select id="fileType" @change="selectOption" class="w-full bg-transparent placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-lg pl-3 pr-8 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
                <option selected>Selecione una opción</option> 
                <option value="fz">Pagos del área de Finanzas</option>
                <option value="rd">Consumos del área de Residenciales</option>
                <option value="tk">Lectura de tanques</option>
            </select>
            <svg class="w-6 h-6 text-gray-800 absolute top-2 right-4 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
            </svg>              
        </div>
        <div class="relative mr-2 w-2/5">
            <select @change="getParamId" class="w-full bg-transparent placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-lg pl-3 pr-8 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
                <option selected>{{ optionsToShow.name }}</option> 
                <option :value="`${option.value}`" v-for="option in optionsToShow.options">
                    {{ option.name }}
                </option>
            </select>
            <svg class="w-6 h-6 text-gray-800 absolute top-2 right-4 hover:cursor-pointer" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
            </svg>              
        </div>
        <input id="path" disabled type="text" :value="selectedFilePath" class="border text-slate-400 rounded-lg block w-1/3 p-2 border-gray-600 focus:ring-2 focus:ring-gray-600 focus:outline-none focus:ring-offset-0" placeholder="Seleccionar archivo">
        <button @click="start" class="w-[100px] ml-6 text-white bg-[#075985] bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 px-2">Seleccionar</button>
        <button @click="upload" class="w-[100px] ml-2 mr-6 text-white bg-green-700 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 px-2">Subir</button>
    </div>

    <div class="max-w-full border mt-4 mx-4" v-if="toShowType === 'fz'">  
        <div class="py-2 mx-4">
            <h3 class="text-xl font-medium">Pagos</h3>
        </div>
        <div class="flex flex-col overflow-x-auto overflow-y-auto inline-block min-w-full align-middle overflow-hidden">
            <table class="sm:rounded-lg min-w-full divide-y">
                <thead class="bg-gray-100">
                    <tr>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">ID pago</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Fecha</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cargado</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Descripción</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cantidad</th>
                    </tr>
                </thead>
                <tbody class="bg-white">
                    <tr class="odd:bg-white even:bg-gray-100" v-for="payment in paymentsToShow">
                        <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">{{ payment.referenceToShow }}</td>
                        <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ payment.done_at }}</td>
                        <td class="p-2 whitespace-nowrap">
                            <span :class="payment.upload.classes">{{ payment.upload.name }}</span>
                        </td>
                        <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ payment.description }}</td>
                        <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">$ {{ payment.amount.toLocaleString() }}</td>
                    </tr>                 
                </tbody>
            </table>
        </div>
    </div>

    <div class="max-w-full border mt-4 mx-4" v-else-if="toShowType === 'rd'">
        <div class="py-2 mx-4">
            <h3 class="text-xl font-medium">Consumos</h3>
        </div>
        <div class="flex flex-col overflow-x-auto overflow-y-auto inline-block min-w-full align-middle overflow-hidden">
            <table class="sm:rounded-lg min-w-full divide-y">
                <thead class="bg-gray-100">
                    <tr>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">ID Cliente</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Nombre</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Consumo (Lts.)</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Total</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cargado</th>
                    </tr>
                </thead>
                <tbody class="bg-white">
                    <tr class="odd:bg-white even:bg-gray-100" v-for="consumption in consumptionsToShow">
                        <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">{{ consumption.folio }}</td>
                        <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ consumption.department }}</td>
                        <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ consumption.liters }}</td>
                        <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">$ {{ consumption.total.toLocaleString() }}</td>
                        <td class="p-2 whitespace-nowrap">
                            <span :class="consumption.upload.classes">{{ consumption.upload.name }}</span>
                        </td>
                    </tr>                 
                </tbody>
            </table>
        </div>
    </div>

    <div class="max-w-full border mt-4 mx-4" v-else-if="toShowType === 'tk'">
        <div class="py-2 mx-4">
            <h3 class="text-xl font-medium">Lectura de tanques</h3>
        </div>
        <div class="flex flex-col overflow-x-auto overflow-y-auto inline-block min-w-full align-middle overflow-hidden">
            <table class="sm:rounded-lg min-w-full divide-y">
                <thead class="bg-gray-100">
                    <tr>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">ID Tanque</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Inicial</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Final</th>
                        <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cargado</th>
                    </tr>
                </thead>
                <tbody class="bg-white">
                    <tr class="odd:bg-white even:bg-gray-100" v-for="tank in tanksToShow">
                        <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">{{ tank.id }}</td>
                        <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ tank.initial }}%</td>
                        <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ tank.final }}%</td>
                        <td class="p-2 whitespace-nowrap">
                            <span :class="tank.upload.classes">{{ tank.upload.name }}</span>
                        </td>
                    </tr>                 
                </tbody>
            </table>
        </div>
    </div>

    <div class="m-4 flex justify-center items-center gap-2">
        <div class="flex justify-center items-center gap-2">
            <div @click="getPrevious" class="hover:cursor-pointer hover:bg-gray-200 rounded py-1">
                <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7"/>
                </svg> 
            </div>
            <p class="font-normal text-black">{{ position.end }} de {{ count }} </p>   
            <div @click="getNext" class="hover:cursor-pointer hover:bg-gray-200 rounded py-1">
                <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/>
                </svg>  
            </div>
        </div>          
    </div>
</template>