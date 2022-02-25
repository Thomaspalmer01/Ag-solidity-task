const {expect , use} = require("chai");
const { ethers } = require("hardhat");
const {solidity} = require("ethereum-waffle");
const { BigNumber } = require("ethers");
const {time} = require("@openzeppelin/test-helpers");
//use default BigNumber
use(solidity);

const getBytes = (data) => {
  return (data.split("").reverse().join("").replace(/^0+/,'')).split("").reverse().join("");
}

describe("NameRegister",  function () {

  // let registerContract,owner,account1,account2; 
  beforeEach(async () => {
    RegisterFactory = await ethers.getContractFactory("NameRegister");
    registerContract = await RegisterFactory.deploy();
    [owner, account1,account2]  = await ethers.getSigners();
    transactionCount = await registerContract.getTrxCount();
  });
  
  it("should deploy successsfully", async () => {
    const fee = await registerContract.FEE();
    expect(fee).to.equal(BigNumber.from("1000000000000000000"));
  });

  it("should set a new price,fee,min name length , locktime , max no fee length", async () => {
    let timeLock = time.duration.years(30);
    await registerContract.connect(owner).setPrice(BigNumber.from("3000000000000000000"));
    await registerContract.connect(owner).setFee(BigNumber.from("2000000000000000000"));
    await registerContract.connect(owner).setMinLength(BigNumber.from("5"));
    await registerContract.connect(owner).setMaxNoFeeLength(BigNumber.from("12"));
    await registerContract.connect(owner).setLockTime((timeLock).toString());
    //check 
    expect((await registerContract.NAME_PRICE())).to.equal(BigNumber.from("3000000000000000000"));
    expect((await registerContract.FEE())).to.equal(BigNumber.from("2000000000000000000"));
    expect((await registerContract.MINIMUM_NAME_LENGHT())).to.equal(BigNumber.from("5"));
    expect((await registerContract.MAX_NO_FEE_NAME_LENGTH())).to.equal(BigNumber.from("12"));
    expect((await registerContract.NAME_LOCK_TIME())).to.equal((timeLock).toString());
  });

    it("should revert  set a new price,fee,min name length , locktime , max no fee length", async () => {
    let timeLock = time.duration.years(30);
    await expect(registerContract.connect(account1).setPrice(BigNumber.from("3000000000000000000"))).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(registerContract.connect(account1).setPrice(BigNumber.from("3000000000000000000"))).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(registerContract.connect(account1).setFee(BigNumber.from("2000000000000000000"))).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(registerContract.connect(account1).setMinLength(BigNumber.from("5"))).to.be.revertedWith("Ownable: caller is not the owner");;
    await expect(registerContract.connect(account1).setMaxNoFeeLength(BigNumber.from("12"))).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(registerContract.connect(account1).setLockTime((timeLock).toString())).to.be.revertedWith("Ownable: caller is not the owner");
  })

  it("should register a name", async () => {
     const name = getBytes(ethers.utils.formatBytes32String("jumia"));
     await registerContract.connect(account1).register(name,transactionCount,{value : "3000000000000000000" })
     const balance = await registerContract.getBalance(account1.address);
     expect(balance).to.equal(BigNumber.from("3000000000000000000"));
     const nameInfo = await registerContract.getNameInfo(name);
     expect(nameInfo.amount).to.equal(BigNumber.from("1000000000000000000"));
     expect(nameInfo.fee).to.equal(BigNumber.from("0"));
     expect(nameInfo.owner).to.equal(account1.address);
     expect(nameInfo.name).to.equal(name);
  });

  it("should register a name for any other address after previous holder expires", async () => {
    const name = getBytes(ethers.utils.formatBytes32String("jumia"));
    const name2 = getBytes(ethers.utils.formatBytes32String("jumia2"));


    let timeLock = time.duration.seconds(1);
    await registerContract.connect(owner).setLockTime((timeLock).toString()); //set locktime

    transactionCount = await registerContract.getTrxCount();
    await registerContract.connect(account2).register(name2,transactionCount,{value : "3000000000000000000" }); //register a name2

    transactionCount = await registerContract.getTrxCount();
    await registerContract.connect(account2).register(name,transactionCount,{value : "3000000000000000000" }); //register a name1

    let purchases1 = await registerContract.connect(account2).getPurchasesList();
    expect(purchases1.length).to.equal(2);
    expect(purchases1[0]).to.equal(ethers.utils.keccak256(name2));
    expect(purchases1[1]).to.equal(ethers.utils.keccak256(name));
    let nameInfo = await registerContract.getNameInfo(name);
    expect(nameInfo.owner).to.equal(account2.address);


    await ethers.provider.send("evm_increaseTime", [120])
    await ethers.provider.send("evm_mine"); //extend time by 2 min

    transactionCount = await registerContract.getTrxCount();
    await registerContract.connect(account1).register(name,transactionCount,{value : "3000000000000000000" }); //repurchase by another user
    purchases1 = await registerContract.connect(account2).getPurchasesList();
    let purchases2 = await registerContract.connect(account1).getPurchasesList();

    expect(purchases1.length).to.equal(1);
    expect(purchases1[0]).to.equal(ethers.utils.keccak256(name2))

    expect(purchases2.length).to.equal(1);
    expect(purchases2[0]).to.equal(ethers.utils.keccak256(name))

    let nameInfo2 = await registerContract.getNameInfo(name);
    expect(nameInfo2.owner).to.equal(account1.address);
    console.log((nameInfo2.expires.sub(nameInfo.expires)).toString());
    expect(nameInfo2.expires.sub(nameInfo.expires)).to.be.at.least(BigNumber.from("120"))

    await expect(registerContract.connect(account1).register(name2,transactionCount,{value : "3000000000000000000" })).to.be.revertedWith("Not a valid transaction count") //listen to revert
    
    transactionCount = await registerContract.getTrxCount();
    await registerContract.connect(account1).register(name,transactionCount,{value : "3000000000000000000" }); //renew

 });


  it("should emmit event on register name", async () => {
      const name = getBytes(ethers.utils.formatBytes32String("jumia"));
      const tx =  await registerContract.connect(account1).register(name,transactionCount,{value : "3000000000000000000" });
      const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
      const interface = new ethers.utils.Interface(["event nameRegistered(uint  indexed timestamp,bytes name,address indexed owner)"]);
      const event = interface.decodeEventLog("nameRegistered",receipt.logs[0].data,receipt.logs[0].topics);
      expect(event.name).to.equal((name));
      expect(event.owner).to.equal(account1.address);
  });

  it("should renew name successsfully", async () => {
    const name = getBytes(ethers.utils.formatBytes32String("jumia"));

    let timeLock = time.duration.seconds(1);
    await registerContract.connect(owner).setLockTime((timeLock).toString()); //set locktime

    transactionCount = await registerContract.getTrxCount();
    await registerContract.connect(account2).register(name,transactionCount,{value : "3000000000000000000" }); //register a name
    let nameInfo1 = await registerContract.getNameInfo(name);

    await ethers.provider.send("evm_increaseTime", [120])
    await ethers.provider.send("evm_mine"); //extend time by 2 min

    transactionCount = await registerContract.getTrxCount();
    await registerContract.connect(account2).renew(name,transactionCount); //repurchase by another user
    let purchases = await registerContract.connect(account2).getPurchasesList();
    let nameInfo2 = await registerContract.getNameInfo(name);

    expect(purchases.length).to.equal(1);
    expect(purchases[0]).to.equal(ethers.utils.keccak256(name))
    expect(nameInfo1.owner).to.equal(account2.address);
    expect(nameInfo2.owner).to.equal(account2.address);
    expect(nameInfo2.expires.sub(nameInfo1.expires)).to.be.at.least(BigNumber.from("1"))

 });

 it("should revert renew if wrong -- transaction count ,  not owner , insufficient balance", async () => {
  const name = getBytes(ethers.utils.formatBytes32String("jumia"));
  const name2 = getBytes(ethers.utils.formatBytes32String("jumia2"));

  let timeLock = time.duration.seconds(1);
  await registerContract.connect(owner).setLockTime((timeLock).toString()); //set locktime

  await expect(registerContract.connect(account2).renew(name2,transactionCount)).to.be.revertedWith("Not a valid transaction count") 


  transactionCount = await registerContract.getTrxCount();
  await expect(registerContract.connect(account2).renew(name2,transactionCount)).to.be.revertedWith("You do not own this domain") 

  transactionCount = await registerContract.getTrxCount();
  await registerContract.connect(account2).register(name,transactionCount,{value : "1000000000000000000" }); //register a name

  await ethers.provider.send("evm_increaseTime", [120])
  await ethers.provider.send("evm_mine"); //extend time by 2 min

  await registerContract.connect(account2).withdraw("1000000000000000000"); //make withdrawal

  transactionCount = await registerContract.getTrxCount();
  await expect(registerContract.connect(account2).renew(name,transactionCount)).to.be.revertedWith("Insufficient Amount");


});


  it("should not register if name is already taken" , async () => {
    const name = getBytes(ethers.utils.formatBytes32String("jumia"));
    await registerContract.connect(account1).register(name,transactionCount,{value : "3000000000000000000" });
    transactionCount = await registerContract.getTrxCount();
    await expect(registerContract.connect(account1).register(name,transactionCount,{value : "30000000000000000"})).to.be.revertedWith("Name not available");
  })

  it("should not register if address doesnt send enough ethers" , async () => {
    const name =getBytes(ethers.utils.formatBytes32String("jumia"));
    await expect(registerContract.connect(account1).register(name,transactionCount,{value : "30000000"})).to.be.revertedWith("Insufficient Amount");
  })

  it("should not register if name length is too small" , async () => {
    let name = getBytes(ethers.utils.formatBytes32String("j"));
    await expect(registerContract.connect(account1).register(name,transactionCount,{value : "3000000000000000000"})).to.be.revertedWith("Name is too short");
  })


  it("should withdraw successsfully", async () => {
    const name = getBytes(ethers.utils.formatBytes32String("jumia"));

    let timeLock = time.duration.seconds(1);
    await registerContract.connect(owner).setLockTime((timeLock).toString()); //set locktime

    const provider = ethers.provider;

    transactionCount = await registerContract.getTrxCount();
    await registerContract.connect(account2).register(name,transactionCount,{value : "1000000000000000000" }); //register a name
    expect(await registerContract.getBalance(account2.address)).to.equal(BigNumber.from("1000000000000000000"));
    let balance2= await provider.getBalance(account2.address);

    await ethers.provider.send("evm_increaseTime", [120])
    await ethers.provider.send("evm_mine"); //extend time by 2 min
  
    await registerContract.connect(account2).withdraw("1000000000000000000"); //make withdrawal
    expect(await registerContract.getBalance(account2.address)).to.equal(BigNumber.from("0"));

    let balance3 = await provider.getBalance(account2.address);
    expect(balance3.sub(balance2)).to.be.at.least(BigNumber.from("999942631599374300"))  
  });

  it("should not withdraw ", async () => {
    const name = getBytes(ethers.utils.formatBytes32String("jumia"));

    let timeLock = time.duration.days(10);
    await registerContract.connect(owner).setLockTime((timeLock).toString()); //set locktime

    transactionCount = await registerContract.getTrxCount();
    await registerContract.connect(account2).register(name,transactionCount,{value : "1000000000000000000" }); //register a name
    await ethers.provider.send("evm_increaseTime", [120])

    await ethers.provider.send("evm_mine"); //extend time by 2 min

    await  expect(registerContract.connect(account2).withdraw("1000000000000000000")).to.be.revertedWith("Insufficient balance");
  });


  it("should deposit successsfully", async () => {
    const provider = ethers.provider;
    await registerContract.connect(account2).deposit({value : "1000000000000000000" }); //register a name
    expect(await registerContract.getBalance(account2.address)).to.equal(BigNumber.from("1000000000000000000"));
    let balance2= await provider.getBalance(account2.address);
  });






});
