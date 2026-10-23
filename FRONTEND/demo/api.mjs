// Synthetic fixtures, served only by `npm run demo`. No backend connections.
const permissions = [
  "bills.view", "bills.create", "bills.update", "bills.delete", "bills.mark_payment",
  "party_bills.view", "party_bills.create", "users.view", "tournament_brackets.view",
  "car_rentals.view", "shuttles.view",
];
const players = ["Minh Anh", "Hoàng Nam", "Thu Hà", "Quang Huy"].map((name, i) => ({
  id: i + 1, name, gender: i % 2 ? "male" : "female", is_active: true,
}));
const dateBefore = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
function makeBill(id, days, total, paidCount, parentId = null) {
  return {
    id, date: dateBefore(days), parent_bill_id: parentId,
    total_amount: total, court_cost: total - 160000, shuttle_cost: 160000,
    court_hours: 2, court_price: (total - 160000) / 2, note: "Buổi cầu mẫu",
    bill_shuttles: [], bill_menus: [], sub_bills: [],
    bill_players: players.map((user, i) => ({
      id: id * 10 + i, user_id: user.id, user, is_paid: i < paidCount,
      total_amount: total / players.length, debt_amount: 0, debt_details: [],
      court_amount: (total - 160000) / players.length, shuttle_amount: 40000,
      menu_amount: 0, ratio: 1, hours: 2,
    })),
  };
}

export function demoApi() {
  let bills = [
    makeBill(2678794, 1, 774000, 1), makeBill(2678793, 3, 620000, 0),
    makeBill(2678792, 5, 856000, 2), makeBill(2678791, 8, 680000, 1),
    makeBill(2678790, 10, 720000, 0), makeBill(2678789, 12, 540000, 4),
    makeBill(2678795, 1, 180000, 1, 2678794),
    ...Array.from({ length: 7 }, (_, i) => makeBill(2678788 - i, 14 + i * 2, 640000 + i * 12000, i % 3)),
  ];
  const partyBills = [
    { id: 101, name: "Ăn tối sau buổi cầu", date: dateBefore(2), total_amount: 960000 },
    { id: 102, name: "Giao lưu cuối tuần cùng câu lạc bộ", date: dateBefore(8), total_amount: 1200000 },
  ].map((bill) => ({ ...bill, note: "Dữ liệu demo", items: [], participants: players.map((user, i) => ({
    id: i + 1, user_id: user.id, user, name: user.name,
    is_paid: i === 0, total_amount: bill.total_amount / 4, share_amount: bill.total_amount / 4,
    paid_amount: i === 0 ? bill.total_amount / 4 : 0, food_amount: 0, ratio_value: 1,
  })) }));

  return {
    name: "local-mobile-demo",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(/<title>.*?<\/title>/, "<title>Demo mobile · Sổ cầu lông</title>");
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (!url.pathname.startsWith("/api/")) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        const send = (data, status = 200) => {
          res.statusCode = status;
          res.end(JSON.stringify(data));
        };
        const path = url.pathname.slice(4);
        if (req.method === "GET") {
          if (path === "/me") return send({ id: 99, name: "Tài khoản Demo", roles: [{
            name: "admin", display_name: "Demo", permissions: permissions.map((name) => ({ name })),
          }] });
          if (path === "/bills") return send(bills.filter((bill) =>
            (!url.searchParams.get("date_from") || bill.date >= url.searchParams.get("date_from")) &&
            (!url.searchParams.get("date_to") || bill.date <= url.searchParams.get("date_to"))));
          const match = path.match(/^\/bills\/(\d+)(\/sub-bills)?$/);
          if (match) {
            const bill = bills.find((item) => item.id === Number(match[1]));
            if (!bill) return send({ message: "Không tìm thấy bill mẫu" }, 404);
            const subBills = bills.filter((item) => item.parent_bill_id === bill.id);
            return send(match[2] ? subBills : { ...bill, sub_bills: subBills });
          }
          if (path === "/party-bills") return send(partyBills);
          if (/^\/party-bills\/\d+$/.test(path)) return send(partyBills.find((bill) => bill.id === Number(path.split("/")[2])));
          if (path === "/players") return send(players);
          if (path === "/shuttles") return send([
            { id: 1, name: "Cầu Hải Yến S100", stock_quantity: 156, price: 20000 },
            { id: 2, name: "Cầu Thành Công", stock_quantity: 30, price: 18000 },
          ]);
          return send([]);
        }
        const deletion = path.match(/^\/bills\/(\d+)$/);
        if (req.method === "DELETE" && deletion) {
          const id = Number(deletion[1]);
          bills = bills.filter((bill) => bill.id !== id && bill.parent_bill_id !== id);
          return send({ success: true });
        }
        const payment = path.match(/^\/bills\/(\d+)\/players\/(\d+)\/pay$/);
        if (req.method === "POST" && payment) {
          let body = "";
          for await (const chunk of req) body += chunk;
          try {
            const player = bills.find((bill) => bill.id === Number(payment[1]))?.bill_players.find((p) => p.user_id === Number(payment[2]));
            if (!player) return send({ message: "Không tìm thấy người chơi mẫu" }, 404);
            player.is_paid = Boolean(JSON.parse(body).is_paid);
            return send({ success: true });
          } catch {
            return send({ message: "Dữ liệu không hợp lệ" }, 400);
          }
        }
        return send({ message: "Bản demo chỉ hỗ trợ xem, lọc, xóa và thanh toán bill cầu mẫu." }, 405);
      });
    },
  };
}
