import { Injectable, EventEmitter, Inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { environment } from '../../environments/environment';


function get_target_emission_per_year(activated_share) {
  if (activated_share <= 0.33) {
    return 0.2;
  } else if (activated_share >= 0.66) {
    return 0.1;
  }
  return -10. / 33 * (activated_share - 0.33) + 0.2;
}


function get_continuous_rate(emission_rate) {
  const blocks_per_hour = 2 * 3600;
  return (Math.pow(1 + emission_rate, 1. / blocks_per_hour) - 1) * blocks_per_hour;
}

function get_vote_rewards(per_vote_bucket, producer_votes, total_votes) {
  return per_vote_bucket * producer_votes / total_votes;
}

function get_block_rewards(per_block_bucket, unpaid_blocks, total_unpaid_blocks) {
  return per_block_bucket * unpaid_blocks / total_unpaid_blocks;
}

function get_producer_reward(per_block_bucket, unpaid_blocks, total_unpaid_blocks, per_vote_bucket, producer_votes, total_votes) {
  return get_block_rewards(
    per_block_bucket,
    unpaid_blocks,
    total_unpaid_blocks) + get_vote_rewards(per_vote_bucket, producer_votes, total_votes);
}

@Injectable()
export class MainService {

  //eosRateReady: EventEmitter<any> = new EventEmitter();
  eosRateReady = {};
  votesToRemove;

  WINDOW: any = window;

  eosConfig = {
    chainId: "",
    httpEndpoint: "",
    expireInSeconds: 60,
    broadcast: true,
    debug: false,
    sign: true,
    /*logger: {
      log: console.log,
      error: console.error
    }*/
  };
  ungerKey = "EOS1111111111111111111111111111111114T1Anm";
  // liveTXHide = localStorage.getItem('liveTXHide') ? true : false;
  liveTXHide = true;
  frontConfig = environment.frontConfig;

  private messageSource = new BehaviorSubject("");
  currentMessage = this.messageSource.asObservable();

  changeMessage(message: string) {
      this.messageSource.next(message)
  }

  constructor() {}

  setEosPrice(data){
      this.eosRateReady = data;
  }
  getEosPrice(){
      return this.eosRateReady;
  }

  sortArray(data) {
      if(!data){
        return;
      }
      let result = [];
      data.sort((a, b) => {
          return b.total_votes - a.total_votes;
      }).forEach((elem, index) => {
          if (elem.producer_key === this.ungerKey){
              return;
          }
          let eos_votes = Math.floor(this.calculateEosFromVotes(elem.total_votes));
          elem.all_votes = elem.total_votes;
          elem.total_votes = Number(eos_votes).toLocaleString();

          result.push(elem);
      });
      return result;
  }

  countRate(data, totalProducerVoteWeight, globalTable, tokenTable, producersTable) {
      if(!data){
        return;
      }
      this.votesToRemove = data.reduce((acc, cur) => {
            const percentageVotes = cur.all_votes / totalProducerVoteWeight * 100;
            if (percentageVotes * 200 < 100) {
              acc += parseFloat(cur.all_votes);
            }
            return acc;
      }, 0);
      data.forEach((elem, index) => {
        elem.index   = index + 1;
        elem.rate    = (!totalProducerVoteWeight) ? 0 : (elem.all_votes / totalProducerVoteWeight * 100).toLocaleString();
        elem.rewards = (!totalProducerVoteWeight) ? 0 : this.countRewards(globalTable, tokenTable, elem);
      });

      return data;
  }

  countRewards(globalTable, tokenTable, producer) {

    const global_table_data = globalTable['rows'][0];
    const active_stake = parseFloat(global_table_data['active_stake']) / 10000;
    const per_block_bucket = parseFloat(global_table_data['perblock_bucket']) / 10000;
    const per_vote_bucket = parseFloat(global_table_data['pervote_bucket']) / 10000;
    const total_unpaid_blocks = parseFloat(global_table_data['total_unpaid_blocks']);
    const total_votes = parseFloat(global_table_data['total_producer_vote_weight']);

    const total_supply = parseFloat(tokenTable['rows'][0]['supply']);
    const emission_rate = get_target_emission_per_year(active_stake / total_supply);
    const continuous_rate = get_continuous_rate(emission_rate);
    const seconds_per_year = 52 * 7 * 24 * 3600;
    const seconds_per_day = 24 * 3600;
    const new_tokens = continuous_rate * total_supply * seconds_per_day / seconds_per_year;
    const to_producers = new_tokens * 0.8;
    const to_per_block_pay = to_producers / 4;
    const to_per_vote_pay = to_producers - to_per_block_pay;

    // console.log(producer)

    return get_producer_reward(
      to_per_block_pay,
      producer.unpaid_blocks,
      total_unpaid_blocks,
      to_per_vote_pay,
      producer.all_votes ? producer.all_votes : producer.total_votes,
      total_votes,
    ).toFixed(2);
  }

  calculateEosFromVotes(votes){
      let date = +new Date() / 1000 - 946684800; // 946... start timestamp
      if (this.frontConfig.coin === 'WAX'){
        let weight = parseInt(`${ date / (86400 * 7) }`, 10) / 13;
        return votes / (2 ** weight) / 100000000;
      }
      let weight = parseInt(`${ date / (86400 * 7) }`, 10) / 52; // 86400 = seconds per day 24*3600
      return votes / (2 ** weight) / 10000;
  };


  getGlobalNetConfig(){
    if (!this.getCookie("netsConf")){
      this.eosConfig.chainId = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";
      this.eosConfig.httpEndpoint = "http://bp.cryptolions.io";
      return this.WINDOW.Eos(this.eosConfig);
    }
      let cookie = JSON.parse(this.getCookie("netsConf"));
      let net = localStorage.getItem("netName") || "mainNet";
      this.eosConfig.chainId = cookie[net].chainId;
      this.eosConfig.httpEndpoint = cookie[net].httpEndpoint;
      return this.WINDOW.Eos(this.eosConfig);
  }

  getCookie(name) {
      let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
      ));
      return matches ? decodeURIComponent(matches[1]) : undefined;
  }

  sortBlocks(data){
       if (!data){
           return null;
       }
       data.sort((a, b) => {
           if (a.block_num < b.block_num){
               return 1;
           } else {
               return -1;
           }
       });
       return data;
  }

// end service export
}
