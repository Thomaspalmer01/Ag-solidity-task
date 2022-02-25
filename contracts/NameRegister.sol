//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract NameRegister is Ownable{

  using SafeMath for uint256;
  struct NameInfo{
    bytes name;
    address owner;
    uint amount;
    uint fee;
    uint256 expires;
  }
  mapping(bytes32 => NameInfo) public nameRegister;
  mapping(address => uint) private balances;
  mapping(address => bytes32[]) public purchases;
  /** constant **/
   uint256  public NAME_PRICE = 1 ether;
   uint256  public FEE = 1 ether;
   uint256  public MINIMUM_NAME_LENGHT = 3;
   uint256 public NAME_LOCK_TIME = 10 days;
   uint256 public MAX_NO_FEE_NAME_LENGTH = 10;
   uint256 transactionCounter;
   event nameRegistered(
     uint  indexed timestamp,
     bytes name,
     address indexed owner
   );
   event Withdraw(
     uint  indexed timestamp,
     uint indexed amount,
     address indexed receiver
   );
  
    
  /*
  * This function is used to register a name
  **/
  function register(bytes memory _name, uint counter) isValidTxtCount(counter) isNameAvailabe(_name) isNameLengthValid(_name) isSufficientEther(_name) public payable  {
      bytes32 hash = getNameHash(_name);
      NameInfo memory info = NameInfo({
         name : _name,
         owner : _msgSender(),
         amount : NAME_PRICE,
         fee : getFee(_name),
         expires : (block.timestamp + NAME_LOCK_TIME)
       });
      if(nameRegister[hash].owner != address(0)){
          if(nameRegister[hash].owner != _msgSender()){
              address prevOwner = nameRegister[hash].owner;
              //remove from owner purchases
              bytes32[] storage hashes = purchases[prevOwner];
              for(uint i = 0 ; i < hashes.length;i++){
                  if(hashes[i] == hash && i < (hashes.length - 1)){
                    bytes32 later = hashes[i+1];
                    hashes[i+1] = hashes[i];
                    hashes[i] = later;
                  }
              }    
              hashes.pop();         
              balances[_msgSender()] = balances[_msgSender()].add(msg.value.sub(getFee(_name)));
              nameRegister[hash] = info;
              purchases[_msgSender()].push(hash);
              transactionCounter = transactionCounter.add(1);
              emit nameRegistered(block.timestamp,_name,_msgSender());
          }else{
            renew(_name,counter);
          }
      }else{
       balances[_msgSender()] = balances[_msgSender()].add(msg.value.sub(getFee(_name)));
       nameRegister[hash] = info;
       purchases[_msgSender()].push(hash);
        transactionCounter = transactionCounter.add(1);
       emit nameRegistered(block.timestamp,_name,_msgSender());
      }
  }

  /*
  * This function is used to renew a name
  **/
  function renew(bytes memory _name,uint counter ) isValidTxtCount(counter)   isNameOwner(_name) public {
        uint price = calculatePrice(_name);
        require(getUnlockedBalance(_msgSender())  >= price, "Insufficient Amount");
        balances[_msgSender()] = balances[_msgSender()].sub(getFee(_name));
        bytes32  hash = getNameHash(_name);
        nameRegister[hash].expires =  nameRegister[hash].expires.add(NAME_LOCK_TIME);
        nameRegister[hash].amount = NAME_PRICE;
        nameRegister[hash].fee =  getFee(_name);
        transactionCounter = transactionCounter.add(1);
        emit nameRegistered(block.timestamp,_name,_msgSender());
  }

  /*
   This function is used to withdraw
   */
   function withdraw(uint _amount) isZero(_amount) public {
        require(getUnlockedBalance(_msgSender()) >= _amount , "Insufficient balance");
        balances[_msgSender()] = balances[_msgSender()].sub(_amount);
        payable(msg.sender).transfer(_amount);
        emit Withdraw(block.timestamp,_amount,_msgSender());
   }

    /**
     *- Withdraw function 
     */
    function withdrawAll() public onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

   /**
   * This gets the fee by name size
   **/
   function getTrxCount() public view returns(uint){
      return transactionCounter;
   }

    /**
   * This gets the fee by name size
   **/
   function getFee(bytes memory _name) public view returns(uint){
     if(_name.length > MAX_NO_FEE_NAME_LENGTH){
       return FEE;
     }else{
       return 0;
     }
   }
   /**
   * This gets an owners unlocked balance
   **/
   function getUnlockedBalance(address _account) public view returns(uint){
     bytes32[] memory allPurchases =  purchases[_account];
     uint lockedBalance;
     for(uint x = 0 ; x < allPurchases.length ; x++){
       NameInfo memory info = nameRegister[allPurchases[x]];
       if(info.expires > block.timestamp){
         lockedBalance = lockedBalance.add(info.amount);
       }
     }
     return (balances[_account].sub(lockedBalance));
   }


   /**
   * This gets an owners locked balances
   **/
   function getLockedBalance(address _account) public view returns(uint){
     bytes32[] memory allPurchases =  purchases[_account];
     uint lockedBalance;
     for(uint x = 0 ; x < allPurchases.length ; x++){
       NameInfo memory info = nameRegister[allPurchases[x]];
       if(info.expires > block.timestamp){
         lockedBalance = lockedBalance.add(info.amount);
       }
     }
     return lockedBalance;
   }

  /**
   * This gets the list of all names owned by an address
  **/
  function getPurchasesList() public view  returns(bytes32[] memory){
      return purchases[msg.sender];
  }

/**
   * This gets the list of all names owned by an address
  **/
  function getBalance(address account) public view returns(uint){
      return balances[account];
  }


  /**
   * This gets the info about a specific names owned by an address
  **/
  function getNameInfo(bytes memory _name) public view returns(NameInfo memory){
      bytes32 hash = getNameHash(_name);
      return nameRegister[hash];
    //   return (info.name,info.owner,info.amount,info.fee,info.expires);
  }


  /**
   * This gets the hash of the name
  **/
  function getNameHash(bytes memory  name) public pure returns(bytes32){
    return keccak256(abi.encodePacked(name));
  }

  /*
  * This function is used to calculate the price of a name
  */
  function calculatePrice(bytes memory name) public view returns(uint){
     if(name.length > MAX_NO_FEE_NAME_LENGTH){
       return (NAME_PRICE + FEE);
     }
     return NAME_PRICE;
  }

  function deposit() isZero(msg.value) external payable {
      balances[_msgSender()] = balances[_msgSender()].add(msg.value);
  }


  /*
  * This function is used to set the price
  */
  function setPrice(uint price) isZero(price) onlyOwner public {
        NAME_PRICE = price;
        transactionCounter = transactionCounter.add(1);
  }

  /*
  * This function is used to set the fee
  */
  function setFee(uint fee) isZero(fee) onlyOwner public {
        FEE = fee;
        transactionCounter = transactionCounter.add(1);
  }

  /*
  * This function is used to set the min length
  */
  function setMinLength(uint length) isZero(length) onlyOwner public {
        MINIMUM_NAME_LENGHT = length;
        transactionCounter = transactionCounter.add(1);
  }

  /*
  * This function is used to set the lock time
  */
  function setLockTime(uint time) isZero(time) onlyOwner public {
        NAME_LOCK_TIME = time;
        transactionCounter = transactionCounter.add(1);
  }

  /*
  * This function is used to set the max no fee length
  */
  function setMaxNoFeeLength(uint length) isZero(length) onlyOwner public {
        MAX_NO_FEE_NAME_LENGTH = length;
        transactionCounter = transactionCounter.add(1);
  }


  receive() isZero(msg.value) external payable{
        balances[_msgSender()] = balances[_msgSender()].add(msg.value);
  }


  /*
  * check if a value is zero
  */
  modifier isZero(uint _amount){
    require(_amount > 0 , "Amount must be above zero");
        _;
  }


  /*
  * check if an address owns a name
  */
  modifier isNameOwner(bytes memory  name){
    bytes32  nameHash = getNameHash(name);
    require(nameRegister[nameHash].owner == _msgSender()  , "You do not own this domain");
        _;
  }

  /*
  * check if address has enough ether to register the name
  */
  modifier isSufficientEther(bytes memory name){
        uint price = calculatePrice(name);
        require(msg.value >= price, "Insufficient Amount");
        _;
  }


  /*
  * validate the name length
  */
  modifier isNameLengthValid(bytes memory name){
    require(name.length >= MINIMUM_NAME_LENGHT , "Name is too short");
    _;
  }


   /*
   * check if the name is available
   */
   modifier isNameAvailabe(bytes memory  name){
      bytes32  nameHash = getNameHash(name);
      require(nameRegister[nameHash].expires < block.timestamp, "Name not available");
      _;
   }

   /*
   * check if the count is valid
   */
   modifier isValidTxtCount(uint count){
      require(count == transactionCounter, "Not a valid transaction count");
      _;
   }


}