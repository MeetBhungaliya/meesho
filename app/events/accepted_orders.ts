export default class AcceptedOrders {
  constructor(
    public accountId: string,
    public userId: number,
    public ordersCount: number,
    public acceptedAt: Date
  ) {}
}
