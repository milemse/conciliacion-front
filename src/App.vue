<script setup>
import { ref, computed } from 'vue'
import Index from './components/Index.vue'
import IndexConsumptions from './components/IndexConsumptions.vue'
import Upload from './components/Upload.vue'
import Validation from './components/Validation.vue'

const routes = {
    '/': Index,
    '/upload': Upload,
    '/validation': Validation
}
const classes = {
  'selected': 'border p-2 rounded-lg shadow-md text-gray-700',
  'not_selected': 'p-2 text-gray-700 hover:opacity-30'
}
const currentPath = ref(window.location.hash)
const mainClasses = ref(classes.selected)
const uploadClasses = ref(classes.not_selected)
const validationClasses = ref(classes.not_selected)
window.addEventListener('hashchange', () => {
  currentPath.value = window.location.hash

  switch(currentPath.value){
    case '#/':
      mainClasses.value = classes.selected
      uploadClasses.value = classes.not_selected
      validationClasses.value = classes.not_selected
    break
    case '#/upload':
      mainClasses.value = classes.not_selected
      uploadClasses.value = classes.selected
      validationClasses.value = classes.not_selected
    break
    case '#/validation':
      mainClasses.value = classes.not_selected
      uploadClasses.value = classes.not_selected
      validationClasses.value = classes.selected
    break
  }
})

const currentView = computed(() => {
  return routes[currentPath.value.slice(1) || '/'] || NotFound
})
</script>
<template>
  <div class="min-w-[800px] min-h-[600px]">
    <div class="flex h-16 gap-6 items-center justify-between pl-6 mr-6">
      <img class="h-16" src="./assets/logo_provee.png" alt="Logo Provee Gas">
      <div class="flex gap-3 p-1 border-2 rounded-lg text-md ml-2">
        <a :class="mainClasses" href="#/">Principal</a>
        <a :class="uploadClasses" href="#/upload">Carga</a>
        <a :class="validationClasses" href="#/validation">Validación</a>
      </div>
    </div>
      
    <component :is="currentView" />
  </div>
</template>
