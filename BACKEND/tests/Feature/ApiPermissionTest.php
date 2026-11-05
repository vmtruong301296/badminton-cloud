<?php

namespace Tests\Feature;

use App\Models\Permission;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Kiểm quyền từng API: chưa đăng nhập 401, đăng nhập mà thiếu quyền 403 (JSON cố định),
 * có một trong các quyền của route thì qua.
 *
 * EXPECTED là đặc tả quyền từng route, lấy từ việc màn nào của frontend gọi route đó
 * (lý do từng dòng: docs/superpowers/specs/2026-11-05-kiem-quyen-api.md).
 */
class ApiPermissionTest extends TestCase
{
    use RefreshDatabase;

    private const DENIED = ['message' => 'Bạn không có quyền thực hiện thao tác này.'];

    /** Màn Master hiện đủ 4 tab cho ai có một trong các quyền này (App.jsx MasterRouteGuard). */
    private const MASTER_TABS = ['ratios.view', 'menus.view', 'shuttles.view', 'payment_accounts.view'];

    /** Màn tạo / sửa bill cầu: tải + thêm nhanh người chơi, menu, mức tính mặc định. */
    private const BILL_FORMS = ['bills.create', 'bills.update'];

    /** Màn tạo / sửa bill tiệc: tải + thêm nhanh người chơi, mức tính mặc định. */
    private const PARTY_BILL_FORMS = ['party_bills.create', 'party_bills.update'];

    /** Route chỉ cần đăng nhập hoặc công khai: không gắn quyền. */
    private const WITHOUT_PERMISSION = [
        'POST api/login',
        'POST api/logout',
        'GET api/me',
        'GET api/images/{path}',
    ];

    private const EXPECTED = [
        // Người chơi
        'GET api/players' => ['users.view', ...self::BILL_FORMS, ...self::PARTY_BILL_FORMS],
        'POST api/players' => ['users.create', 'users.view', ...self::BILL_FORMS, ...self::PARTY_BILL_FORMS],
        'GET api/players/{player}' => ['users.view'],
        'PUT api/players/{player}' => ['users.update'],
        'DELETE api/players/{player}' => ['users.delete'],
        'GET api/players/{id}/debts' => ['users.view'],
        'POST api/players/{id}/roles' => ['roles.assign'],

        // Mức tính
        'GET api/ratios' => [...self::MASTER_TABS, ...self::BILL_FORMS, ...self::PARTY_BILL_FORMS],
        'GET api/ratios/defaults' => [...self::MASTER_TABS, ...self::BILL_FORMS, ...self::PARTY_BILL_FORMS],
        'POST api/ratios' => ['ratios.create'],
        'GET api/ratios/{ratio}' => ['ratios.view'],
        'PUT api/ratios/{ratio}' => ['ratios.update'],
        'DELETE api/ratios/{ratio}' => ['ratios.delete'],

        // Menu nước
        'GET api/menus' => [...self::MASTER_TABS, ...self::BILL_FORMS],
        'POST api/menus' => ['menus.create', ...self::BILL_FORMS],
        'GET api/menus/{menu}' => ['menus.view'],
        'PUT api/menus/{menu}' => ['menus.update'],
        'DELETE api/menus/{menu}' => ['menus.delete'],

        // Loại cầu
        'GET api/shuttles' => [...self::MASTER_TABS, 'bills.view', ...self::BILL_FORMS],
        'POST api/shuttles' => ['shuttles.create'],
        'GET api/shuttles/{shuttle}' => ['shuttles.view'],
        'PUT api/shuttles/{shuttle}' => ['shuttles.update'],
        'DELETE api/shuttles/{shuttle}' => ['shuttles.delete'],
        'GET api/shuttles/{id}/stock-entries' => ['shuttles.view', 'shuttles.update'],
        'POST api/shuttles/{id}/stock-entries' => ['shuttles.update'],
        'GET api/shuttles/{id}/prices' => ['shuttles.view', 'shuttles.update'],
        'POST api/shuttles/{id}/prices' => ['shuttles.update'],
        'DELETE api/shuttles/{id}/prices/{priceId}' => ['shuttles.update'],

        // Bill cầu
        'GET api/bills' => ['bills.view'],
        'POST api/bills' => ['bills.create'],
        'GET api/bills/{bill}' => ['bills.view', ...self::BILL_FORMS],
        'PUT api/bills/{bill}' => ['bills.update'],
        'DELETE api/bills/{bill}' => ['bills.delete'],
        'POST api/bills/{id}/players/{player_id}/pay' => ['bills.mark_payment'],
        'GET api/bills/{id}/sub-bills' => ['bills.view'],
        'POST api/bills/{id}/sub-bills' => ['bills.create'],
        'POST api/bills/{id}/send-telegram' => ['bills.view'],

        // Nợ (frontend chưa gọi; không có quyền riêng)
        'GET api/debts' => ['users.view'],
        'POST api/debts' => ['users.update'],
        'GET api/debts/{debt}' => ['users.view'],
        'PUT api/debts/{debt}' => ['users.update'],
        'DELETE api/debts/{debt}' => ['users.update'],

        // Tài khoản nhận tiền
        'GET api/payment-accounts' => [...self::MASTER_TABS, 'bills.view', 'party_bills.view'],
        'POST api/payment-accounts' => ['payment_accounts.create'],
        'POST api/payment-accounts/{id}/update' => ['payment_accounts.update'],
        'GET api/payment-accounts/{payment_account}' => ['payment_accounts.view'],
        'PUT api/payment-accounts/{payment_account}' => ['payment_accounts.update'],
        'DELETE api/payment-accounts/{payment_account}' => ['payment_accounts.delete'],

        // Bill tiệc
        'GET api/party-bills' => ['party_bills.view', 'car_rentals.view'],
        'POST api/party-bills' => ['party_bills.create'],
        'GET api/party-bills/{party_bill}' => ['party_bills.view', 'party_bills.update'],
        'PUT api/party-bills/{party_bill}' => ['party_bills.update'],
        'DELETE api/party-bills/{party_bill}' => ['party_bills.delete'],
        'POST api/party-bills/{id}/participants/{participantId}/pay' => ['party_bills.update'],
        'POST api/party-bills/{id}/send-telegram' => ['party_bills.view'],

        // Thuê xe + giá xăng
        'GET api/car-rentals' => ['car_rentals.view'],
        'POST api/car-rentals' => ['car_rentals.create'],
        'GET api/car-rentals/{car_rental}' => ['car_rentals.view'],
        'PUT api/car-rentals/{car_rental}' => ['car_rentals.update'],
        'DELETE api/car-rentals/{car_rental}' => ['car_rentals.delete'],
        'GET api/fuel-prices' => ['car_rentals.view'],
        'POST api/fuel-prices/{fuelKey}/refresh' => ['car_rentals.update'],
        'PUT api/fuel-prices/{fuelKey}' => ['car_rentals.update'],

        // Vai trò + quyền
        'GET api/roles' => ['roles.view', 'roles.assign'],
        'POST api/roles' => ['roles.create'],
        'GET api/roles/{role}' => ['roles.view'],
        'PUT api/roles/{role}' => ['roles.update'],
        'DELETE api/roles/{role}' => ['roles.delete'],
        'GET api/permissions' => ['roles.view'],
        'GET api/permissions/{id}' => ['roles.view'],

        // Xếp bảng (dữ liệu theo từng người tạo)
        'GET api/player-lists' => ['tournament_brackets.view'],
        'POST api/player-lists' => ['tournament_brackets.view', 'tournament_brackets.create_list'],
        'GET api/player-lists/{player_list}' => ['tournament_brackets.view'],
        'PUT api/player-lists/{player_list}' => ['tournament_brackets.create_list'],
        'DELETE api/player-lists/{player_list}' => ['tournament_brackets.delete'],
        'GET api/tournament-players' => ['tournament_brackets.view'],
        'POST api/tournament-players' => ['tournament_brackets.view', 'tournament_brackets.create_list'],
        'GET api/tournament-players/{tournament_player}' => ['tournament_brackets.view'],
        'PUT api/tournament-players/{tournament_player}' => ['tournament_brackets.create_list'],
        'DELETE api/tournament-players/{tournament_player}' => ['tournament_brackets.view', 'tournament_brackets.create_list'],
        'POST api/tournament-players/import' => ['tournament_brackets.view', 'tournament_brackets.create_list'],
        'GET api/player-lists/{playerListId}/brackets' => ['tournament_brackets.view'],
        'POST api/player-lists/{playerListId}/brackets/organize' => ['tournament_brackets.organize'],
        'GET api/player-lists/{playerListId}/brackets/{bracketId}' => ['tournament_brackets.view'],
        'DELETE api/player-lists/{playerListId}/brackets/{bracketId}' => ['tournament_brackets.delete'],
        'DELETE api/player-lists/{playerListId}/brackets' => ['tournament_brackets.delete'],
    ];

    /** Bộ quyền của các vai trò trên production (bản dump 15/10/2026); admin có đủ 42 quyền. */
    private const PRODUCTION_ROLES = [
        'scheduler' => [
            'bills.create', 'bills.mark_payment', 'bills.update', 'bills.view',
            'menus.view',
            'party_bills.create', 'party_bills.update', 'party_bills.view',
            'ratios.view', 'shuttles.view',
            'tournament_brackets.create_list', 'tournament_brackets.organize', 'tournament_brackets.view',
            'users.view',
        ],
        'tournament_scheduler' => [
            'tournament_brackets.create_list', 'tournament_brackets.delete',
            'tournament_brackets.organize', 'tournament_brackets.view',
        ],
        'tournament_viewer' => ['tournament_brackets.view'],
    ];

    /** Màn xếp bảng: mọi người vào được đều thấy Thêm VĐV / Import / Xóa VĐV và tự tạo danh sách mặc định. */
    private const TOURNAMENT_SCREEN_CALLS = [
        'GET /api/player-lists',
        'POST /api/player-lists',
        'GET /api/tournament-players',
        'POST /api/tournament-players',
        'POST /api/tournament-players/import',
        'DELETE /api/tournament-players/1',
        'GET /api/player-lists/1/brackets',
    ];

    /** API các màn của từng vai trò gọi (theo App.jsx / ProtectedRoute / hasPermission trong màn). */
    private const ROLE_SCREEN_CALLS = [
        'scheduler' => [
            // Dashboard (bills.view): danh sách, tồn kho cầu, "Đã trả hết" (bills.mark_payment)
            'GET /api/bills', 'GET /api/shuttles', 'POST /api/bills/1/players/1/pay',
            // Chi tiết bill (bills.view): tài khoản nhận tiền, gửi Telegram
            'GET /api/bills/1', 'GET /api/payment-accounts', 'POST /api/bills/1/send-telegram',
            // Tạo / sửa bill (bills.create / bills.update): danh sách + thêm nhanh người chơi, menu
            'GET /api/players', 'POST /api/players', 'GET /api/ratios', 'GET /api/menus', 'POST /api/menus',
            'POST /api/bills', 'PUT /api/bills/1',
            // Bill tiệc (party_bills.*): đánh dấu thanh toán dùng party_bills.update
            'GET /api/party-bills', 'GET /api/party-bills/1', 'POST /api/party-bills',
            'PUT /api/party-bills/1', 'POST /api/party-bills/1/participants/1/pay',
            'POST /api/party-bills/1/send-telegram',
            // Master (ratios/menus/shuttles.view): bốn tab đọc
            'GET /api/payment-accounts',
            ...self::TOURNAMENT_SCREEN_CALLS,
            'POST /api/player-lists/1/brackets/organize',
        ],
        'tournament_scheduler' => [
            ...self::TOURNAMENT_SCREEN_CALLS,
            'POST /api/player-lists/1/brackets/organize',
            'DELETE /api/player-lists/1/brackets',
        ],
        'tournament_viewer' => self::TOURNAMENT_SCREEN_CALLS,
    ];

    /** Thao tác vai trò KHÔNG có quyền: phải 403. */
    private const ROLE_FORBIDDEN_CALLS = [
        'scheduler' => [
            'DELETE /api/bills/1', 'DELETE /api/party-bills/1',
            'PUT /api/players/1', 'DELETE /api/players/1', 'POST /api/players/1/roles',
            'GET /api/roles', 'POST /api/roles', 'GET /api/permissions',
            'POST /api/payment-accounts', 'PUT /api/ratios/1', 'DELETE /api/menus/1',
            'GET /api/car-rentals', 'DELETE /api/player-lists/1/brackets',
        ],
        'tournament_scheduler' => [
            'GET /api/bills', 'GET /api/players', 'POST /api/players', 'POST /api/players/1/roles',
            'POST /api/roles', 'GET /api/party-bills', 'GET /api/shuttles',
        ],
        'tournament_viewer' => [
            'POST /api/player-lists/1/brackets/organize', 'DELETE /api/player-lists/1/brackets',
            'GET /api/bills', 'POST /api/players/1/roles',
        ],
    ];

    protected function setUp(): void
    {
        parent::setUp();

        // Không route nào trong test được gọi ra mạng thật (Telegram, trang giá xăng).
        Http::fake();
    }

    public function test_moi_route_can_dang_nhap_deu_gan_dung_quyen(): void
    {
        $actual = [];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/')) {
                continue;
            }

            $key = $route->methods()[0].' '.$route->uri();
            $middleware = $route->gatherMiddleware();
            $permissionMiddleware = array_values(array_filter(
                $middleware,
                fn ($m) => is_string($m) && str_starts_with($m, 'permission:'),
            ));

            if (in_array($key, self::WITHOUT_PERMISSION, true)) {
                $this->assertSame([], $permissionMiddleware, "{$key} không được gắn quyền");

                continue;
            }

            $this->assertContains('auth', $middleware, "{$key} phải yêu cầu đăng nhập");
            $this->assertCount(1, $permissionMiddleware, "{$key} phải có đúng một middleware quyền");
            $actual[$key] = $this->sorted(explode('|', substr($permissionMiddleware[0], strlen('permission:'))));
        }

        $expected = array_map(fn (array $permissions) => $this->sorted($permissions), self::EXPECTED);
        ksort($expected);
        ksort($actual);

        $this->assertSame($expected, $actual);
    }

    public function test_quyen_dung_trong_route_deu_co_trong_seeder(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $known = Permission::pluck('name')->all();

        foreach (self::EXPECTED as $key => $permissions) {
            foreach ($permissions as $permission) {
                $this->assertContains($permission, $known, "{$key}: quyền {$permission} không có trong RolePermissionSeeder");
            }
        }
    }

    public static function protectedRoutes(): iterable
    {
        return self::routesWithId('1');
    }

    /** Mọi route có quyền, tham số đường dẫn thay bằng $id: [method, uri]. */
    private static function routesWithId(string $id): iterable
    {
        foreach (array_keys(self::EXPECTED) as $key) {
            [$method, $uri] = explode(' ', $key, 2);

            yield $key => [$method, '/'.preg_replace('/\{[^}]+\}/', $id, $uri)];
        }
    }

    #[DataProvider('protectedRoutes')]
    public function test_route_chan_khach_va_nguoi_thieu_quyen_cho_qua_nguoi_dung_quyen(string $method, string $uri): void
    {
        $this->seed(RolePermissionSeeder::class);
        // GET api/ratios/defaults khai báo sau apiResource nên request tới đó rơi vào ratios/{ratio}:
        // lấy quyền theo route thực sự nhận request.
        $allowed = self::EXPECTED[$this->matchedRouteKey($method, $uri)];

        $this->json($method, $uri)->assertUnauthorized();

        $this->actingAs($this->userWithPermissions([]))
            ->json($method, $uri)
            ->assertForbidden()
            ->assertExactJson(self::DENIED);

        $otherPermissions = Permission::whereNotIn('name', $allowed)->pluck('name')->all();
        $this->actingAs($this->userWithPermissions($otherPermissions))
            ->json($method, $uri)
            ->assertForbidden();

        foreach ($allowed as $permission) {
            $status = $this->actingAs($this->userWithPermissions([$permission]))->json($method, $uri)->status();

            $this->assertNotContains($status, [401, 403], "{$method} {$uri} với quyền {$permission} bị chặn ({$status})");
        }
    }

    public function test_admin_goi_duoc_moi_api(): void
    {
        $this->actingAs($this->adminUser());

        // Id không tồn tại: các route xóa không xóa mất chính admin (users.id 1) hay vai trò admin giữa chừng.
        foreach (self::routesWithId('999999') as [$method, $uri]) {
            $status = $this->json($method, $uri)->status();

            $this->assertNotContains($status, [401, 403], "admin bị chặn ở {$method} {$uri} ({$status})");
        }
    }

    public static function productionRoles(): iterable
    {
        foreach (array_keys(self::PRODUCTION_ROLES) as $role) {
            yield $role => [$role];
        }
    }

    #[DataProvider('productionRoles')]
    public function test_vai_tro_production_goi_duoc_moi_api_man_cua_minh_dang_goi(string $role): void
    {
        $this->actingAs($this->userWithPermissions(self::PRODUCTION_ROLES[$role]));

        foreach (self::ROLE_SCREEN_CALLS[$role] as $call) {
            [$method, $uri] = explode(' ', $call, 2);
            $status = $this->json($method, $uri)->status();

            $this->assertNotContains($status, [401, 403], "{$role} bị chặn ở {$call} ({$status})");
        }
    }

    #[DataProvider('productionRoles')]
    public function test_vai_tro_production_bi_chan_o_thao_tac_khong_co_quyen(string $role): void
    {
        $this->actingAs($this->userWithPermissions(self::PRODUCTION_ROLES[$role]));

        foreach (self::ROLE_FORBIDDEN_CALLS[$role] as $call) {
            [$method, $uri] = explode(' ', $call, 2);

            $this->json($method, $uri)->assertForbidden();
        }
    }

    public function test_scheduler_tao_bill_them_nhanh_nguoi_choi_danh_dau_thanh_toan_tao_bill_tiec(): void
    {
        $this->actingAs($this->userWithPermissions(self::PRODUCTION_ROLES['scheduler']));

        // Thêm nhanh người chơi đúng payload của PlayerSelector
        $playerId = $this->postJson('/api/players', [
            'name' => 'Khách mới',
            'gender' => 'male',
            'default_ratio' => 1,
            'email' => 'khachmoi1730000000000@badminton.local',
            'password' => 'password',
        ])->assertCreated()->json('id');

        $billId = $this->postJson('/api/bills', [
            'date' => '2026-11-05',
            'court_total' => 200000,
            'shuttles' => [],
            'players' => [['user_id' => $playerId, 'ratio_value' => 1]],
        ])->assertCreated()->json('id');

        $this->postJson("/api/bills/{$billId}/players/{$playerId}/pay", ['amount' => 200000, 'is_paid' => true])
            ->assertOk();
        $this->getJson("/api/bills/{$billId}")->assertOk()->assertJsonPath('bill_players.0.is_paid', true);

        $partyBill = $this->postJson('/api/party-bills', [
            'date' => '2026-11-05',
            'name' => 'Tiệc test',
            'base_amount' => 300000,
            'extras' => [],
            'participants' => [['user_id' => $playerId, 'name' => 'Khách mới', 'ratio_value' => 1]],
        ])->assertCreated()->json();

        $participantId = $partyBill['participants'][0]['id'];
        $this->postJson("/api/party-bills/{$partyBill['id']}/participants/{$participantId}/pay", ['is_paid' => true])
            ->assertOk();
    }

    public function test_tournament_scheduler_lam_du_luong_xep_bang(): void
    {
        $this->actingAs($this->userWithPermissions(self::PRODUCTION_ROLES['tournament_scheduler']));

        $this->getJson('/api/player-lists')->assertOk()->assertJsonCount(0);
        $listId = $this->postJson('/api/player-lists', ['name' => 'Danh sách mặc định', 'is_default' => true])
            ->assertCreated()
            ->json('id');

        foreach ([['An', 'male', 1], ['Bình', 'male', 2], ['Chi', 'female', 1], ['Dung', 'female', 2]] as [$name, $gender, $level]) {
            $this->postJson('/api/tournament-players', [
                'player_list_id' => $listId,
                'name' => $name,
                'gender' => $gender,
                'level' => $level,
            ])->assertCreated();
        }

        $csv = UploadedFile::fake()->createWithContent('vdv.csv', "Ten,Gioi tinh,Level\nEm,male,3\nGiang,female,3\n");
        $this->post('/api/tournament-players/import', ['player_list_id' => $listId, 'file' => $csv], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('imported', 2);

        $players = $this->getJson("/api/tournament-players?player_list_id={$listId}")->assertOk()->assertJsonCount(6)->json();
        $this->deleteJson("/api/tournament-players/{$players[0]['id']}")->assertOk();

        $this->postJson("/api/player-lists/{$listId}/brackets/organize", [
            'player_list_id' => $listId,
            'number_of_brackets' => 2,
            'gender_distribution' => 'mixed',
        ])->assertSuccessful();
        $this->getJson("/api/player-lists/{$listId}/brackets")->assertOk()->assertJsonCount(2);

        $this->deleteJson("/api/player-lists/{$listId}/brackets")->assertOk();
        $this->getJson("/api/player-lists/{$listId}/brackets")->assertOk()->assertJsonCount(0);
    }

    private function matchedRouteKey(string $method, string $uri): string
    {
        $route = Route::getRoutes()->match(Request::create($uri, $method));

        return $route->methods()[0].' '.$route->uri();
    }

    private function sorted(array $values): array
    {
        sort($values);

        return $values;
    }
}
