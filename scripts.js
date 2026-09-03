// Moedas que o conversor suporta. Pra adicionar uma nova é só colocar aqui
// (o código do par tem que existir na AwesomeAPI, ex: CAD-BRL, CHF-BRL etc).
const CURRENCIES = {
  USD: { symbol: "US$", name: "Dólar Americano", flag: "🇺🇸" },
  EUR: { symbol: "€", name: "Euro", flag: "🇪🇺" },
  GBP: { symbol: "£", name: "Libra Esterlina", flag: "🇬🇧" },
  JPY: { symbol: "¥", name: "Iene Japonês", flag: "🇯🇵" },
  ARS: { symbol: "AR$", name: "Peso Argentino", flag: "🇦🇷" },
  BTC: { symbol: "₿", name: "Bitcoin", flag: "₿" },
}

const REFRESH_INTERVAL_MS = 60_000 // busca cotação nova a cada 1 minuto

// Monta a URL da AwesomeAPI já com todos os pares de uma vez, tipo:
// .../last/USD-BRL,EUR-BRL,GBP-BRL...
const API_URL = `https://economia.awesomeapi.com.br/last/${Object.keys(CURRENCIES)
  .map((code) => `${code}-BRL`)
  .join(",")}`

// Formatter do Real que reaproveito em todo lugar em vez de ficar
// chamando toLocaleString toda hora.
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

// Referências dos elementos do DOM que eu uso — deixo tudo junto aqui
// pra não ficar espalhando getElementById pelo arquivo inteiro.
const dom = {
  form: document.getElementById("converterForm"),
  amount: document.getElementById("amount"),
  currency: document.getElementById("currency"),
  submitButton: document.getElementById("submitButton"),
  submitLabel: document.getElementById("submitLabel"),
  formStatus: document.getElementById("formStatus"),
  tickerTrack: document.getElementById("tickerTrack"),
  result: document.getElementById("result"),
  rateLine: document.getElementById("rateLine"),
  resultValue: document.getElementById("resultValue"),
  resultTimestamp: document.getElementById("resultTimestamp"),
}

// rates guarda a última resposta da API por moeda, tipo:
// { USD: { bid: "4.87", pctChange: "-0.32", ... } }
let rates = {}
let lastUpdatedAt = null

init()

function init() {
  // só deixa digitar número no campo de valor
  dom.amount.addEventListener("input", () => {
    dom.amount.value = dom.amount.value.replace(/\D+/g, "")
  })

  dom.form.addEventListener("submit", handleSubmit)

  // busca a cotação assim que a página carrega e depois fica atualizando sozinho
  fetchRates()
  setInterval(fetchRates, REFRESH_INTERVAL_MS)
}

// Busca as cotações na AwesomeAPI (é grátis e não precisa de API key).
// Se der erro (sem internet, API fora do ar etc) eu travo o formulário
// pra não deixar converter com valor desatualizado ou zerado.
async function fetchRates() {
  try {
    const response = await fetch(API_URL)
    if (!response.ok) throw new Error(`AwesomeAPI respondeu ${response.status}`)

    const data = await response.json()

    // a API devolve tipo "USDBRL", "EURBRL"... aqui eu só reorganizo
    // pra ficar fácil de acessar por rates.USD, rates.EUR etc.
    rates = Object.keys(CURRENCIES).reduce((acc, code) => {
      const entry = data[`${code}BRL`]
      if (entry) acc[code] = entry
      return acc
    }, {})

    lastUpdatedAt = new Date()
    setFormReady(true)
    renderTicker()
    renderCurrencyOptions()
  } catch (error) {
    console.error("Falha ao buscar cotações:", error)
    setFormReady(false)
    dom.tickerTrack.innerHTML = `<span class="ticker__item">cotações indisponíveis</span>`
    setStatus("Não foi possível carregar as cotações. Verifique sua conexão e tente novamente.")
  }
}

function handleSubmit(event) {
  event.preventDefault()
  setStatus("")

  const code = dom.currency.value
  const rate = rates[code]

  // isso não devia acontecer (o select só lista moeda com cotação),
  // mas fica a validação por garantia
  if (!rate) {
    setStatus("Cotação indisponível para essa moeda no momento.")
    return
  }

  const value = Number(dom.amount.value)
  if (!dom.amount.value || Number.isNaN(value)) {
    setStatus("Digite um valor válido para converter.")
    return
  }

  // "bid" é a cotação de compra, que é o valor que a AwesomeAPI recomenda
  // usar pra conversão
  renderResult(value, Number(rate.bid), CURRENCIES[code].symbol)
}

function renderResult(amount, rate, symbol) {
  dom.rateLine.textContent = `${symbol} 1 = ${brl.format(rate)}`
  dom.resultValue.textContent = brl.format(amount * rate)
  dom.resultTimestamp.textContent = lastUpdatedAt
    ? `atualizado às ${lastUpdatedAt.toLocaleTimeString("pt-BR")}`
    : ""
  dom.result.classList.add("is-visible")
}

// Monta a fita de cotações que fica rolando no topo do card.
function renderTicker() {
  const items = Object.entries(CURRENCIES)
    .map(([code, info]) => {
      const rate = rates[code]
      if (!rate) return ""

      const change = Number(rate.pctChange)
      const direction = change >= 0 ? "up" : "down"
      const arrow = change >= 0 ? "▲" : "▼"

      return `
        <span class="ticker__item">
          ${info.flag} <b>${code}</b> ${brl.format(rate.bid)}
          <span class="change--${direction}">${arrow} ${Math.abs(change).toFixed(2)}%</span>
        </span>
      `
    })
    .join("")

  // duplico o conteúdo pra dar aquele efeito de scroll infinito
  // (a animação no CSS anda só metade da largura e depois reinicia)
  dom.tickerTrack.innerHTML = items + items
}

// Preenche o <select> com as moedas que têm cotação disponível.
// Chamo essa função de novo a cada atualização (60 em 60s) então guardo
// o valor que já estava selecionado pra não perder a escolha do usuário.
function renderCurrencyOptions() {
  const previousValue = dom.currency.value

  dom.currency.innerHTML = `<option value="" disabled hidden>Selecione a moeda</option>`
  for (const [code, info] of Object.entries(CURRENCIES)) {
    const option = document.createElement("option")
    option.value = code
    option.textContent = `${info.flag} ${info.name}`
    dom.currency.append(option)
  }

  if (rates[previousValue]) dom.currency.value = previousValue
}

// Liga/desliga o formulário conforme a gente tem (ou não) cotação carregada.
function setFormReady(isReady) {
  dom.currency.disabled = !isReady
  dom.submitButton.disabled = !isReady
  dom.submitLabel.textContent = isReady ? "Converter em reais" : "Cotação indisponível"
}

function setStatus(message) {
  dom.formStatus.textContent = message
}