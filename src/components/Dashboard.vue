<script setup>
import { ref, onBeforeMount } from 'vue'

import { invoke } from '@tauri-apps/api/core'
import { fetch } from '@tauri-apps/plugin-http'

let HOST_FROM_EXPORT = ''

onBeforeMount(async function () {
    HOST_FROM_EXPORT = await invoke('get_enviroment_variable', { name: 'HOST_FROM_EXPORT' })
})

async function getReports(){
    const selectBlock = document.getElementById('block')
    const selectedIndex = selectBlock.selectedIndex
    const block_str = selectBlock.options[selectedIndex].value

    if(!isNaN(block_str)){
        const block = parseInt(block_str)
        const response = await fetch(HOST_FROM_EXPORT + 'reports', { method: 'GET' })
        console.log(response.body)
    }
}
</script>
<template>
    <div class="w-full h-full flex justify-center items-center gap-2">
        <div class="w-96 h-96 border rounded-lg p-2 shadow-md flex flex-col justify-center items-center">
            <h1 class="text-md font-bold">Reportes</h1>
            <div class="relative w-[calc(50%)] mt-2">
                <select id="block" class="w-full bg-transparent text-xs placeholder:text-gray-400 focus:ring-gray-600 text-slate-900 focus:ring-2 focus:ring-gray-600 border border-slate-900 rounded-md pl-3 py-2 transition duration-300 ease focus:outline-none hover:border-slate-900 shadow-sm focus:shadow-md appearance-none cursor-pointer">
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
            <button class="w-1/2 mt-2 text-white bg-green-700 bg-opacity-90 hover:bg-opacity-100 focus:ring-4 focus:outline-none font-semibold rounded-md text-sm text-center focus:ring-gray-600 p-2" @click="getReports">Descargar reportes</button>
        </div>
    </div>
</template>