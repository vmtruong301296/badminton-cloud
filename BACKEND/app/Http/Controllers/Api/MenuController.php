<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMenuRequest;
use App\Http\Requests\UpdateMenuRequest;
use App\Models\Menu;
use Illuminate\Http\JsonResponse;

class MenuController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        // Menu mới tạo lên đầu. Sắp xếp theo id thay vì created_at vì id luôn
        // phản ánh đúng thứ tự tạo và không bị null ở các bản ghi import từ dump.
        $menus = Menu::orderByDesc('id')->get();

        return response()->json($menus);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreMenuRequest $request): JsonResponse
    {
        $menu = Menu::create($request->validated());

        return response()->json($menu, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $menu = Menu::findOrFail($id);

        return response()->json($menu);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateMenuRequest $request, string $id): JsonResponse
    {
        $menu = Menu::findOrFail($id);
        $menu->update($request->validated());

        return response()->json($menu);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $menu = Menu::findOrFail($id);
        $menu->delete();

        return response()->json(['message' => 'Menu deleted successfully']);
    }
}
