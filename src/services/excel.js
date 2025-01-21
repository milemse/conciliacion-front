import { columns } from '../utils/columns'
import { md5 } from 'js-md5'

export async function getPaymentsInformation(workbook, linker, typeUpload, db) {
    const sheetNames = workbook.SheetNames
    let paymentSheets = [ sheetNames.shift(), sheetNames.shift(), sheetNames.shift(), sheetNames.shift(), sheetNames.shift(), sheetNames.shift() ]
    const bbvaRegex = /bbva/i
    const indexes = []

    resetLinker(linker)
    paymentSheets = paymentSheets.filter(item => typeof item !== 'undefined')

    for(let sheetName of paymentSheets) {
        let index = 1
        const sheet = workbook.Sheets[sheetName]

        while(index < 10) {
            if(sheet[`A${index}`])
                if(sheet[`A${index}`].v)
                    break

            index++
        }
        indexes.push(index)
    }

    for(let index in paymentSheets) {
        const sheet = workbook.Sheets[paymentSheets[index]]

        const keys = Object.keys(linker)
        for(let key of keys) {
            for(let column of columns) {
                if(sheet[`${column}${indexes[index]}`]) {
                    let str = new String(sheet[`${column}${indexes[index]}`].v)
                    str = str.replaceAll('\n', '')
                    str = str.replaceAll('\t', '')
                    str = str.replaceAll('\r', '')
                    str = str.replaceAll(' ', '')
                    str = str.toLocaleLowerCase()

                    const columnArray = linker[key].name.split(':')
                    const columnName = bbvaRegex.test(paymentSheets[index]) ? columnArray[0] : columnArray[1]
                    if(str === columnName) {
                        linker[key].column.push(column)
                        break
                    }
                }
            }
        }
    }

    const payments = []
    for(let index in paymentSheets){
        const sheet = workbook.Sheets[paymentSheets[index]]
        
        let columnIndex = indexes[index] + 1
        let description = sheet[`${linker.description.column[index]}${columnIndex}`]
        let amount = sheet[`${linker.amount.column[index]}${columnIndex}`]
        let done_at = sheet[`${linker.done_at.column[index]}${columnIndex}`]
        let reference = sheet[`${linker.reference.column[index]}${columnIndex}`]

        let payment = {
            description: description ? description.v : '',
            amount: amount ? amount.v : 0.0,
            done_at: done_at ? formatDate(done_at.w) : '',
            reference: reference ? `${reference.w}-${index}:${columnIndex}` : `${index}:${columnIndex}`,
            upload: typeUpload.not_upload
        }

        payment.reference = new String(md5(`${payment.reference}-${payment.description}-${payment.amount}-${payment.done_at}`)) + `-${index}:${columnIndex}`

        if(amount)
            payments.push(payment)

        columnIndex++
        while(description){
            description = sheet[`${linker.description.column[index]}${columnIndex}`]
            amount = sheet[`${linker.amount.column[index]}${columnIndex}`]
            done_at = sheet[`${linker.done_at.column[index]}${columnIndex}`]
            reference = sheet[`${linker.reference.column[index]}${columnIndex}`]

            if(amount){
                payment = {
                    description: description ? description.v : '',
                    amount: amount ? amount.v : 0.0,
                    done_at: done_at ? formatDate(done_at.w) : '',
                    reference: reference ? `${reference.w}-${index}:${columnIndex}` : `${index}:${columnIndex}`,
                    upload: typeUpload.not_upload
                }

                payment.reference = new String(md5(`${payment.reference}-${payment.description}-${payment.amount}-${payment.done_at}`)) + `-${index}:${columnIndex}`

                payments.push(payment)
            }

            columnIndex++
        }
    }

    const selectPayment = `select payment_id from main.payment where reference = $1`
    const toShowPayments = []

    for(let payment of payments){
        const tempPayment = await db.select(selectPayment, [payment.reference])

        if(tempPayment.length === 0)
            toShowPayments.push(payment)
    }

    return toShowPayments
}

export function getConsumptionsInformation(workbook, linker, typeUpload) {
    const sheet = workbook.Sheets[workbook.SheetNames.shift()]
    const keys = Object.keys(linker)
    const consumptions = []

    let index = 1
    while(index < 10){
        if(sheet[`A${index}`]){
            const name = sheet[`A${index}`].v 
            if(name.toLowerCase().trim() === 'condominio')
                break
        }    
        index++
    }

    for (let item of keys){
        for(let column of columns){
            if(sheet[`${column}${index}`]){
                let str = new String(sheet[`${column}${index}`].v)
                str = str.replaceAll('\n', '')
                str = str.replaceAll('\t', '')
                str = str.replaceAll('\r', '')
                str = str.replaceAll(' ', '')
                str = str.toLocaleLowerCase()
    
                if(str === linker[item].name)
                    linker[item].column = column
            }
        }
    }

    for(let idx = index + 1; idx < 1_000; idx++){
        // Lecturas
        const last_reading = sheet[`${linker.last_reading.column}${idx}`] ? sheet[`${linker.last_reading.column}${idx}`].v : 0.0
        const current_reading = sheet[`${linker.current_reading.column}${idx}`] ? sheet[`${linker.current_reading.column}${idx}`].v : 0.0
    
        // Cliente
        const owner = sheet[`${linker.owner.column}${idx}`] ? sheet[`${linker.owner.column}${idx}`].v : ''
        const folio = sheet[`${linker.folio.column}${idx}`] ? sheet[`${linker.folio.column}${idx}`].v : ''
        const department = sheet[`${linker.department.column}${idx}`] ? sheet[`${linker.department.column}${idx}`].v : ''

        // Consumo
        let factor = sheet[`${linker.conversion_factor.column}${idx}`] ? sheet[`${linker.conversion_factor.column}${idx}`].v : 0.0
        const admon = sheet[`${linker.price_admon.column}${idx}`] ? sheet[`${linker.price_admon.column}${idx}`].v : 0.0
        let m3 = sheet[`${linker.consumption.column}${idx}`] ? sheet[`${linker.consumption.column}${idx}`].v : 0.0
        let liters = sheet[`${linker.consumption_liters.column}${idx}`] ? sheet[`${linker.consumption_liters.column}${idx}`].v : 0.0
        let debt = sheet[`${linker.debt.column}${idx}`] ? sheet[`${linker.debt.column}${idx}`].v : 0.0
        let total = sheet[`${linker.total.column}${idx}`] ? sheet[`${linker.total.column}${idx}`].v : 0.0
    
        // Cuenta
        const reference = sheet[`${linker.reference.column}${idx}`] ? sheet[`${linker.reference.column}${idx}`].v : ''
   
        if(!department)
            break

        const clientInformation = {
            last_reading: last_reading.toFixed(3),
            current_reading: current_reading.toFixed(3),
            owner,
            department,
            folio,
            factor: factor.toFixed(2),
            admon: admon.toFixed(2),
            m3: m3.toFixed(4),
            liters: liters.toFixed(4),
            debt: debt.toFixed(2),
            total: total.toFixed(2),
            reference,
            upload: typeUpload.not_upload
        }

        consumptions.push(clientInformation)
    }

    return consumptions
}

export function getTanksInformation(workbook, linker_tanks, block, typeUpload){
    const sheet = workbook.Sheets[`BLOQUE ${block}`]
    let index = 2
    const tanks = []

    for (let idx = index; idx < 200; idx++){
        index = 2
        const tank = {
            id: sheet[`${linker_tanks.id.column}${idx}`] ? sheet[`${linker_tanks.id.column}${idx}`].v : 0,
            initial: sheet[`${linker_tanks.initial.column}${idx}`] ? parseInt(parseFloat(sheet[`${linker_tanks.initial.column}${idx}`].v) * 100) : 0,
            final: sheet[`${linker_tanks.final.column}${idx}`] ? parseInt(parseFloat(sheet[`${linker_tanks.final.column}${idx}`].v) * 100) : 0,
            upload: typeUpload.not_upload
        }

        if(index == 0 && !tank.id)
            break

        if(tank.id)
            tanks.push(tank)

        index--
    }

    return tanks
}

export async function uploadPayments(db, payments, upload){
    for (let item of payments) {
        const fecha = item.done_at
        const insertPyment = `insert into main.payment(description, done_at, amount, reference, validated, to_download) values($1, '${fecha}', $2, $3, false, false)`

        const selectPreviousPayments = `select payment_id from main.payment where payment.reference ilike '%${item.reference.split('-').shift()}%'`
        const resultPreviousPayments = await db.select(selectPreviousPayments)

        console.log('Antes de la validacion')
        console.log(resultPreviousPayments)

        if(!isNaN(item.amount) && resultPreviousPayments.length === 0){
            console.log('Despues de la validacion')
            await db.execute(insertPyment, [item.description, item.amount, item.reference])
            item.upload = upload
        }
    }
}

export async function uploadConsumptions(db, consumptions, upload, in_period_id){
    const selectPreviousConsumptions = `select count(reading_id) as readings from main.client cl join main.reading rd on cl.client_id = rd.client_id where cl.client_id = $1 and rd.period_id = $2`
    let consumptions_uploaded = 0

    for(let consumption of consumptions){
        // Obtener id del cliente
        const selectClientId = `select cl.client_id from main.client as cl join main.account as acc on cl.client_id = acc.client_id where acc.reference_bbva ilike '%' || $1 || '%'`
        const resultClient = await db.select(selectClientId, [new String(consumption.reference)])

        if(resultClient.length > 0){
            const client_id = resultClient.shift().client_id

            // Obtenemos si ya existe una lectura para este cliente en el periodo
            const resultPreviousConsumtion = await db.select(selectPreviousConsumptions, [client_id, in_period_id])
            if(resultPreviousConsumtion.shift().readings > 0){
                consumptions_uploaded++
                continue
            }

            // Actualizamos propietario
            const updateOwner = `update main.client set owner = $1 where client_id = $2`
            await db.execute(updateOwner, [consumption.owner, client_id])

            // Obtener ultimo periodo
            const getLastPeriod = `select period_id from main.period where type = 'CONS' order by period_id desc limit 1`
            const resultPeriod = await db.select(getLastPeriod)
            let period_id = resultPeriod.shift().period_id

            if(in_period_id !== 0)
                period_id = in_period_id

            // Ingresar lecturas
            const insertReading = `insert into main.reading(client_id, last_reading, current_reading, last_url_photo, generated_at, current_url_photo, period_id) values($1, $2, $3, '', now(), '', $4)`
            await db.execute(insertReading, [client_id, consumption.last_reading, consumption.current_reading, period_id])

            // Buscar id de lectura
            const selectReading = `select reading_id from main.reading where client_id = $1 and last_reading = $2 and current_reading = $3`
            const resultReading = await db.select(selectReading, [client_id, consumption.last_reading, consumption.current_reading])
            const reading_id = resultReading.shift().reading_id

            // Insertar informacion de consumo
            const insertConsumption = `insert into main.consumption(factor, price_admin, m3, liters, debt, total, reading_id) values($1, $2, $3, $4, $5, $6, $7)`
            await db.execute(insertConsumption, [parseFloat(consumption.factor), parseFloat(consumption.admon), parseFloat(consumption.m3), parseFloat(consumption.liters), parseFloat(consumption.debt), parseFloat(consumption.total), reading_id])

            consumption.upload = upload
        }
    }

    if(consumptions_uploaded !== 0)
        return -1
    else
        return 0
}

export async function uploadTanks(db, tanks, upload){
    const insertTank = `insert into main.reading_tank(tank_id, last_reading, current_reading, done_at) values($1, $2, $3, now())`

    for (let item of tanks) {
        const tank_id = item.id
        const last_reading = item.initial
        const current_reading = item.final

        if(!isNaN(tank_id) && !isNaN(last_reading) && !isNaN(current_reading)){
            await db.execute(insertTank, [parseInt(tank_id), parseFloat(last_reading), parseFloat(current_reading)])
            item.upload = upload
        }
    }
}

export async function downloadPayments(payments, db){
    const to_download_update = `update main.payment set to_download = true where payment_id = $1`

    for(let payment of payments){
        if(payment.account_id !== null)
            await db.execute(to_download_update, [parseInt(payment.payment_id)]) 
    }
}

export function downloadConsumptions(workbook, linker){
    const sheet = workbook.Sheets[workbook.SheetNames.shift()]
    const keys = Object.keys(linker)

    let index = 1
    while(index < 10){
        if(sheet[`A${index}`]){
            const name = sheet[`A${index}`].v 
            if(name.toLowerCase().trim() === 'condominio')
                break
        }    
        index++
    }

    for (let item of keys){
        for(let column of columns){
            if(sheet[`${column}${index}`]){
                let str = new String(sheet[`${column}${index}`].v)
                str = str.replaceAll('\n', '')
                str = str.replaceAll('\t', '')
                str = str.replaceAll('\r', '')
                str = str.replaceAll(' ', '')
                str = str.toLocaleLowerCase()
    
                if(str === linker[item].name)
                    linker[item].column = column
            }
        }
    }

    return linker
}

function formatDate(date){
    console.log(date)
    const partsOfDate = date.split('/')
    const [ month, day, year ] = partsOfDate

    if (year.length < 4)
        return `20${year}-${month}-${day}`
    else
        return `${year}-${day}-${month}`
}

function resetLinker(linker) {
    const keys = Object.keys(linker)

    for(let key of keys) {
        linker[key].column = []
    }
}