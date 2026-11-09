/**
 * Kiểm form tạo / sửa bill cầu trước khi gửi (M14: lỗi hiện ngay dưới ô). Câu lỗi giữ nguyên
 * câu alert() cũ. Hàm thuần.
 */

export const BILL_FORM_MESSAGES = {
  noPlayers: "Vui lòng chọn ít nhất một người chơi",
  noCourt: "Vui lòng nhập tổng tiền sân",
  noShuttleOrCourt:
    "Vui lòng thêm ít nhất một loại cầu hợp lệ hoặc nhập tổng tiền sân lớn hơn 0",
  zeroQuantity: "Số lượng cầu phải lớn hơn 0",
  zeroRatios: "Tổng mức tính phải lớn hơn 0",
};

/** Tổng mức tính: mức đang chọn, thiếu thì mức mặc định, thiếu nữa thì 1 (như xem trước). */
export const sumPlayerRatios = (players = []) =>
  players.reduce(
    (sum, p) =>
      sum + (Number(p.ratio_value ?? p.default_ratio_value ?? 1) || 0),
    0,
  );

/** Ô tiền sân để trống (bill con mở ra chưa điền tiền sân); số 0 gõ vào vẫn hợp lệ. */
export const isCourtBlank = (courtTotal) =>
  courtTotal === null || courtTotal === undefined || courtTotal === "";

/**
 * Trả lỗi theo ô: { court?, shuttleQuantity: { [chỉ số dòng]: câu }, players? }.
 * Dòng cầu chưa chọn loại bị bỏ qua khi lưu nên không báo lỗi.
 */
export const validateBillForm = ({
  players = [],
  shuttles = [],
  court_total,
} = {}) => {
  const errors = { shuttleQuantity: {} };

  const hasValidShuttle = shuttles.some((s) => s.shuttle_type_id);
  if (isCourtBlank(court_total)) {
    errors.court = BILL_FORM_MESSAGES.noCourt;
  } else if (!hasValidShuttle && !((Number(court_total) || 0) > 0)) {
    errors.court = BILL_FORM_MESSAGES.noShuttleOrCourt;
  }

  shuttles.forEach((s, index) => {
    if (s.shuttle_type_id && !(Number(s.quantity) > 0)) {
      errors.shuttleQuantity[index] = BILL_FORM_MESSAGES.zeroQuantity;
    }
  });

  if (players.length === 0) {
    errors.players = BILL_FORM_MESSAGES.noPlayers;
  } else if (sumPlayerRatios(players) === 0) {
    errors.players = BILL_FORM_MESSAGES.zeroRatios;
  }

  return errors;
};

/**
 * Danh sách lỗi theo thứ tự trên màn (tiền sân → từng dòng cầu → người chơi) để cuộn tới và
 * đặt con trỏ vào ô sai đầu tiên. `field` khớp thuộc tính data-field của ô.
 */
export const billFormErrorList = (errors = {}) => {
  const list = [];
  if (errors.court) list.push({ field: "court", message: errors.court });
  Object.keys(errors.shuttleQuantity || {})
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((index) =>
      list.push({
        field: `shuttle-${index}`,
        message: errors.shuttleQuantity[index],
      }),
    );
  if (errors.players) list.push({ field: "players", message: errors.players });
  return list;
};

/**
 * Câu lỗi máy chủ để nối sau "Có lỗi xảy ra khi tạo bill: ". BillController trả { error } khi
 * lỗi 500 nên đọc cả error, không chỉ message.
 */
export const serverErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  "";
