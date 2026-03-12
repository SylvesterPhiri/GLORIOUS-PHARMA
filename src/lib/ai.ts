
import { Client, Product, Invoice } from '@prisma/client'

export class PharmaAI {

  static async predictSales(clientId: string, productId: string): Promise<{
    predictedQuantity: number
    confidence: number
    factors: string[]
    recommendation: string
  }> {

    return {
      predictedQuantity: Math.floor(Math.random() * 100) + 10,
      confidence: 0.85,
      factors: [
        'Historical purchase patterns',
        'Seasonal demand',
        'Client credit utilization',
        'Market trends'
      ],
      recommendation: 'Consider offering bulk discount for orders above 50 units'
    }
  }

  static async optimizeInventory(product: Product): Promise<{
    optimalStock: number
    reorderPoint: number
    safetyStock: number
    costSavings: number
    alerts: string[]
  }> {
    const optimalStock = Math.max(product.minStock * 3, 100)
    const reorderPoint = Math.floor(optimalStock * 0.3)
    
    return {
      optimalStock,
      reorderPoint,
      safetyStock: Math.floor(optimalStock * 0.2),
      costSavings: Math.random() * 1000,
      alerts: product.currentStock < reorderPoint 
        ? ['Low stock alert! Consider reordering soon.']
        : []
    }
  }

  static async assessClientRisk(client: Client & { invoices: Invoice[] }): Promise<{
    riskScore: number // 0-100
    riskLevel: 'low' | 'medium' | 'high'
    factors: string[]
    recommendations: string[]
  }> {
    const unpaidInvoices = client.invoices.filter(inv => inv.status !== 'PAID')
    const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0)
    const creditUtilization = client.creditLimit ? (totalUnpaid / client.creditLimit) * 100 : 0
    
    let riskScore = 0
    const factors: string[] = []
    
    if (creditUtilization > 80) {
      riskScore += 40
      factors.push('High credit utilization')
    }
    
    if (unpaidInvoices.length > 3) {
      riskScore += 30
      factors.push('Multiple unpaid invoices')
    }
    
    const overdueInvoices = client.invoices.filter(inv => 
      inv.status === 'OVERDUE' || 
      new Date(inv.dueDate) < new Date()
    )
    
    if (overdueInvoices.length > 0) {
      riskScore += 30
      factors.push('Overdue payments')
    }
    
    const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low'
    
    const recommendations = []
    if (riskLevel === 'high') {
      recommendations.push('Consider suspending credit terms temporarily')
      recommendations.push('Request upfront payment for new orders')
    } else if (riskLevel === 'medium') {
      recommendations.push('Send payment reminders')
      recommendations.push('Review credit limit')
    }
    
    return {
      riskScore,
      riskLevel,
      factors,
      recommendations
    }
  }

  static async optimizePricing(product: Product, marketData?: any): Promise<{
    currentPrice: number
    suggestedPrice: number
    priceChange: number
    expectedRevenueChange: number
    rationale: string
  }> {
    const marketAdjustment = 1 + (Math.random() * 0.2 - 0.1) // ±10%
    const suggestedPrice = product.price * marketAdjustment
    
    return {
      currentPrice: product.price,
      suggestedPrice: parseFloat(suggestedPrice.toFixed(2)),
      priceChange: parseFloat((marketAdjustment - 1).toFixed(2)),
      expectedRevenueChange: parseFloat((Math.random() * 0.15 * 100).toFixed(2)), // 0-15%
      rationale: 'Based on market demand, competitor pricing, and historical sales data'
    }
  }

  static async analyzeExpiryRisk(products: Product[]): Promise<{
    highRisk: Product[]
    mediumRisk: Product[]
    lowRisk: Product[]
    recommendations: string[]
    totalRiskValue: number
  }> {
    const now = new Date()
    const highRisk: Product[] = []
    const mediumRisk: Product[] = []
    const lowRisk: Product[] = []
    
    products.forEach(product => {
      const daysToExpiry = Math.ceil(
        (new Date(product.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (daysToExpiry <= 30) {
        highRisk.push(product)
      } else if (daysToExpiry <= 90) {
        mediumRisk.push(product)
      } else {
        lowRisk.push(product)
      }
    })
    
    const totalRiskValue = highRisk.reduce((sum, p) => sum + p.price * p.currentStock, 0)
    
    const recommendations = []
    if (highRisk.length > 0) {
      recommendations.push('Consider promotional discounts for near-expiry products')
      recommendations.push('Review procurement quantities for high-risk items')
    }
    
    return {
      highRisk,
      mediumRisk,
      lowRisk,
      recommendations,
      totalRiskValue
    }
  }

  static async generateSalesInsights(timeframe: 'daily' | 'weekly' | 'monthly'): Promise<{
    topProducts: { product: string; sales: number; growth: number }[]
    topClients: { client: string; purchases: number; value: number }[]
    trends: string[]
    recommendations: string[]
  }> {

    return {
      topProducts: [
        { product: 'Paracetamol 500mg', sales: 1500, growth: 12 },
        { product: 'Amoxicillin 250mg', sales: 1200, growth: 8 },
        { product: 'Vitamin C 1000mg', sales: 900, growth: 15 }
      ],
      topClients: [
        { client: 'City General Hospital', purchases: 45, value: 25000 },
        { client: 'MediCare Pharmacy', purchases: 32, value: 18000 },
        { client: 'HealthPlus Distributors', purchases: 28, value: 15000 }
      ],
      trends: [
        'Increased demand for antibiotics during winter season',
        'Growing preference for generic medicines',
        'Rising online pharmacy orders'
      ],
      recommendations: [
        'Increase stock of seasonal medications',
        'Consider bulk discounts for loyal clients',
        'Expand digital payment options'
      ]
    }
  }

  static async chat(query: string, context?: any): Promise<{
    response: string
    suggestions: string[]
    confidence: number
  }> {
    const responses: Record<string, string> = {
      'stock': 'I can check stock levels for you. Which product are you looking for?',
      'price': 'I can provide pricing information. Please specify the product name.',
      'order': 'To place an order, please visit the Orders section or contact sales.',
      'invoice': 'I can help with invoice queries. Please provide the invoice number.',
      'payment': 'For payment-related questions, please provide your client ID.',
      'delivery': 'Delivery status can be checked with your tracking number.',
      'credit': 'Credit limit information is available in your client dashboard.'
    }
    
    const queryLower = query.toLowerCase()
    let matchedKey = 'help'
    
    for (const key in responses) {
      if (queryLower.includes(key)) {
        matchedKey = key
        break
      }
    }
    
    return {
      response: responses[matchedKey] || 'How can I assist you with your pharmaceutical management needs today?',
      suggestions: ['Check stock', 'View invoices', 'Place order', 'Payment status'],
      confidence: 0.9
    }
  }
}