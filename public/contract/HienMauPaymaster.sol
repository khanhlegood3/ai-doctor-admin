// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@account-abstraction/contracts@0.6.0/core/BasePaymaster.sol";
import "@account-abstraction/contracts@0.6.0/interfaces/UserOperation.sol";
// Bổ sung thư viện Ownable để tương thích với OpenZeppelin v5
import "@openzeppelin/contracts/access/Ownable.sol";

contract HienMauPaymaster is BasePaymaster {
    // Địa chỉ Hợp đồng Affiliate của dự án
    address public affiliateContract;
    
    // Cấu trúc hàm chuẩn của EIP-4337 Smart Account: execute(address,uint256,bytes)
    bytes4 private constant EXECUTE_SELECTOR = bytes4(keccak256("execute(address,uint256,bytes)"));

    // Khởi tạo: Nối Paymaster với EntryPoint, Affiliate, và khai báo Owner cho OZ v5
    constructor(IEntryPoint _entryPoint, address _affiliateContract) 
        BasePaymaster(_entryPoint) 
        Ownable(msg.sender) // Fix lỗi: Bắt buộc truyền msg.sender vào Ownable
    {
        affiliateContract = _affiliateContract;
    }

    // Cập nhật địa chỉ Affiliate nếu dự án nâng cấp phiên bản mới
    function setAffiliateContract(address _newAffiliate) external onlyOwner {
        require(_newAffiliate != address(0), "Paymaster: Invalid address");
        affiliateContract = _newAffiliate;
    }

    // ==========================================
    // TRÁI TIM CỦA PAYMASTER: LOGIC KIỂM DUYỆT CÓ BỘ LỌC THÉP
    // ==========================================
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 /* maxCost */
    ) internal view override returns (bytes memory context, uint256 validationData) {
        
        // 1. Kiểm tra độ dài tối thiểu của dữ liệu (Function Selector chiếm 4 bytes)
        require(userOp.callData.length >= 4, "Paymaster: callData too short");

        // 2. Trích xuất Function Selector (4 bytes đầu tiên)
        bytes4 selector = bytes4(userOp.callData[0:4]);

        // 3. Phải chắc chắn ví đang gọi hàm "execute"
        require(selector == EXECUTE_SELECTOR, "Paymaster: Only standard execute allowed");

        // 4. Bóc tách dữ liệu bên trong (Giải mã ABI)
        (address dest, uint256 value, ) = abi.decode(
            userOp.callData[4:], 
            (address, uint256, bytes)
        );

        // 5. CHỐT CHẶN BẢO MẬT
        require(dest == affiliateContract, "Paymaster: Destination must be Affiliate Contract");
        require(value == 0, "Paymaster: Value transfer not sponsored");

        // Trả về 0 nghĩa là hợp lệ (Đồng ý tài trợ Gas)
        return ("", 0);
    }

    // ==========================================
    // QUẢN LÝ QUỸ GAS (Deposit / Withdraw)
    // ==========================================
    
    // Nạp Test BNB vào Paymaster (thực chất là đẩy thẳng vào quỹ của EntryPoint)
    function depositToEntryPoint() public payable onlyOwner {
        require(msg.value > 0, "Paymaster: Deposit amount must be greater than zero");
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    // Rút quỹ Test BNB về ví Admin (Thu hồi vốn nếu cần)
    function withdrawFromEntryPoint(address payable withdrawAddress, uint256 amount) public onlyOwner {
        require(withdrawAddress != address(0), "Paymaster: Cannot withdraw to zero address");
        entryPoint.withdrawTo(withdrawAddress, amount);
    }
}