package order

type StatusCount struct {
	Status  string `json:"status"`
	Count   int    `json:"count"`
	Revenue string `json:"revenue"`
}

type TopProduct struct {
	ProductName string `json:"productName"`
	Quantity    int    `json:"quantity"`
}

type SummaryResponse struct {
	From        string        `json:"from"`
	To          string        `json:"to"`
	TotalOrders int           `json:"totalOrders"`
	Revenue     string        `json:"revenue"`
	ByStatus    []StatusCount `json:"byStatus"`
	TopProducts []TopProduct  `json:"topProducts"`
}
