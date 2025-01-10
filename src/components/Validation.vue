<script setup>
import { ref, onBeforeMount } from 'vue'
import { invoke } from '@tauri-apps/api/core'

import Database from '@tauri-apps/plugin-sql'

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
  }
}
let DB = {  }

const validations = ref([])
const validations_count = ref(0)
const current_validations = ref(0)
const salt_validations = ref(10)

let PROVEE_TEST = ''

onBeforeMount(async function () {
  PROVEE_TEST = await invoke('get_enviroment_variable', { name: 'PROVEE_TEST' })

  DB = await Database.load(PROVEE_TEST)
  await getGeneralValidations()
})

async function getGeneralValidations(){
  const selectValidationsCount = `select count(*) as validations_count from main.payment py join main.account acc on py.account_id = acc.account_id join main.client cl on acc.client_id = cl.client_id join main.condominium cd on cl.condominium_id = cd.condominium_id where py.account_id is not null and py.validated = false`
  const tempValidationsCount = await DB.select(selectValidationsCount)
  validations_count.value = tempValidationsCount.shift().validations_count
  const selectValidations = `select cl.client_id, py.payment_id, py.account_id, py.description, py.done_at, py.reference, py.amount, py.type_identificacion, acc.reference_bbva as reference, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.payment py join main.account acc on py.account_id = acc.account_id join main.client cl on acc.client_id = cl.client_id join main.condominium cd on cl.condominium_id = cd.condominium_id where py.account_id is not null and py.validated = false order by py.payment_id asc limit ${salt_validations.value}`
  const tempValidations = await DB.select(selectValidations)

  const selectLastTotal = `select cn.total from main.client cl join main.reading rd on cl.client_id = rd.client_id join main.consumption cn on rd.reading_id = cn.reading_id where cl.client_id = $1 order by cn.consumption_id desc limit 1`

  for(let item of tempValidations){
    if(item.type_identificacion === 'rf')
      item.identification = type_identification.reference
    else if(item.type_identificacion === 'am')
      item.identification = type_identification.amount
    else if(item.type_identificacion === 'ch')
      item.identification = type_identification.cash

    const client_id = item.client_id
    const resultLastTotal = await DB.select(selectLastTotal, [client_id])
    item.total = resultLastTotal.shift().total
  }

  validations.value = tempValidations
}

async function validate(payment_id){
  const validatePayment = `update main.payment set validated = true where payment_id = $1`
  await DB.execute(validatePayment, [payment_id])
  await getGeneralValidations()
}

async function unvalidate(payment_id){
  const unvalidatePayment = `update main.payment set account_id = null, validated = false where payment_id = $1`
  await DB.execute(unvalidatePayment, [payment_id])
  await getGeneralValidations()
}

function showPerPageValidations(){

}

async function getPreviousValidations(){
  const offset = (current_validations.value - salt_validations.value) > -1 ? current_validations.value - salt_validations.value : 0
  const temp_validations_count = await DB.select(`select count(*) as validations_count from main.payment py join main.account acc on py.account_id = acc.account_id join main.client cl on acc.client_id = cl.client_id join main.condominium cd on cl.condominium_id = cd.condominium_id where py.account_id is not null and py.validated = false`)
  validations_count.value = temp_validations_count.shift().validations_count
  const selectValidations = `select py.payment_id, py.account_id, py.description, py.done_at, py.reference, py.amount, py.type_identificacion, acc.reference_bbva as reference, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.payment py join main.account acc on py.account_id = acc.account_id join main.client cl on acc.client_id = cl.client_id join main.condominium cd on cl.condominium_id = cd.condominium_id where py.account_id is not null and py.validated = false order by py.payment_id asc limit ${salt_validations.value} offset ${offset}`
  const tempValidations = await DB.select(selectValidations)
  
  for(let item of tempValidations){
    if(item.type_identificacion === 'rf')
      item.identification = type_identification.reference
    else if(item.type_identificacion === 'am')
      item.identification = type_identification.amount
  }

  validations.value = tempValidations
  current_validations.value = offset
}

async function getNextValidations(){
  const offset = (current_validations.value + salt_validations.value) < validations_count.value ? current_validations.value + salt_validations.value : validations_count.value
  const temp_validations_count = await DB.select(`select count(*) as validations_count from main.payment py join main.account acc on py.account_id = acc.account_id join main.client cl on acc.client_id = cl.client_id join main.condominium cd on cl.condominium_id = cd.condominium_id where py.account_id is not null and py.validated = false`)
  validations_count.value = temp_validations_count.shift().validations_count
  const selectValidations = `select py.payment_id, py.account_id, py.description, py.done_at, py.reference, py.amount, py.type_identificacion, acc.reference_bbva as reference, (cd.name || ' ' || cd.building || ' | ' || cl.department) as department from main.payment py join main.account acc on py.account_id = acc.account_id join main.client cl on acc.client_id = cl.client_id join main.condominium cd on cl.condominium_id = cd.condominium_id where py.account_id is not null and py.validated = false order by py.payment_id asc limit ${salt_validations.value} offset ${offset}`
  const tempValidations = await DB.select(selectValidations)
  
  for(let item of tempValidations){
    if(item.type_identificacion === 'rf')
      item.identification = type_identification.reference
    else if(item.type_identificacion === 'am')
      item.identification = type_identification.amount
  }

  validations.value = tempValidations
  current_validations.value = offset
}
</script>
<template>
    <div class="max-w-full border mt-4 mx-4">
        <div class="py-2 mx-4">
          <h3 class="text-xl font-medium">Validaciones</h3>
          <p class="text-md text-gray-500">Esta es una lista de las validaciones por realizar</p>
        </div>
        <div class="flex flex-col overflow-x-auto overflow-y-auto inline-block min-w-full align-middle overflow-hidden">
          <table class="sm:rounded-lg min-w-full divide-y">
            <thead class="bg-gray-100">
              <tr>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">ID pago</th>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Fecha</th>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Descripción</th>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cantidad</th>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Consumo total</th>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Emparejamiento por</th>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Clave referenciada</th>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Cliente</th>
                <th scope="col" class="p-4 text-xs font-bold tracking-wider text-left text-gray-900 uppercase">Validación</th>
              </tr>
            </thead>
            <tbody class="bg-white">
              <tr class="odd:bg-white even:bg-gray-100" v-for="validation in validations">
                <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">{{ validation.payment_id }}</td>
                <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ validation.done_at }}</td>
                <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ validation.description }}</td>
                <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">$ {{ validation.amount.toLocaleString() }}</td>
                <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap">$ {{ validation.total.toLocaleString() }}</td>
                <td class="p-2 whitespace-nowrap">
                  <span :class="validation.identification.classes">{{ validation.identification.name }}</span>
                </td>
                <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ validation.reference }}</td>
                <td class="p-2 text-sm font-normal text-gray-900 whitespace-nowrap">{{ validation.department }}</td>
                <td class="p-2 text-sm font-semibold text-gray-900 whitespace-nowrap flex justify-center items-center gap-2">
                  <button class="rounded-full border p-1 hover:bg-slate-200 hover:opacity-80" @click="validate(validation.payment_id)">
                    <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                    </svg>                    
                  </button>
                  <button class="rounded-full border p-1 hover:bg-slate-200 hover:opacity-80" @click="unvalidate(validation.payment_id)">
                    <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="m15 9-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                    </svg>                    
                  </button>
                </td>
              </tr>                 
            </tbody>
          </table>
        </div>
        <div class="m-4 flex justify-center items-center gap-2">
          <div class="flex justify-center items-center gap-2">
            <div>
              <select id="perPage" @change="showPerPageValidations" class="w-full bg-transparent text-sm placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-lg pl-2 pr-1 py-1 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
                <option selected value="10">10 por página</option> 
                <option value="50">50 por página</option> 
                <option value="75">75 por página</option> 
                <option value="100">100 por página</option>
                <option value="all">Todos</option> 
              </select>
            </div>
            <div @click="getPreviousValidations" class="hover:cursor-pointer hover:bg-gray-200 rounded py-1">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7"/>
              </svg> 
            </div>
            <p class="font-normal text-black">{{ current_validations }} de {{ validations_count }} </p>   
            <div @click="getNextValidations" class="hover:cursor-pointer hover:bg-gray-200 rounded py-1">
              <svg class="w-6 h-6 text-gray-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/>
              </svg>  
            </div>
          </div>          
        </div>
    </div>
</template>